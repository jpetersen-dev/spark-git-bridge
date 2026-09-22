import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer, sessions } from "../lib/server.js";
import { authenticate } from "../lib/auth.js";

function resolveServices(req) {
  const url = req.url || "";
  if (url.includes("/notion/") || url.includes("service=notion")) {
    return ["notion"];
  }
  if (url.includes("/telegram/") || url.includes("service=telegram")) {
    return ["telegram"];
  }
  if (url.includes("/github/") || url.includes("service=github")) {
    return ["github"];
  }
  return ["github", "telegram", "notion"];
}

/**
 * Serverless handler para el endpoint SSE de MCP con capa de seguridad y enrutamiento.
 * Establece el stream SSE únicamente para clientes autorizados y soporta POST directo y HEAD.
 */
export default async function handler(req, res) {
  console.log(`[SSE-INCOMING] ${req.method} ${req.url}`);

  // Configuración de CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-bridge-token, x-api-key, mcp-session-id, Last-Event-ID, mcp-protocol-version"
  );
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id, mcp-protocol-version");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Soporte para comprobaciones HEAD
  if (req.method === "HEAD") {
    return res.status(200).end();
  }

  // 1. Verificación de seguridad del puente (Token secreto)
  const auth = authenticate(req, res);
  if (!auth.authenticated) {
    return;
  }

  const enabledServices = resolveServices(req);

  // 2. Si es GET pero no solicita text/event-stream, responder con 200 OK JSON inmediato
  // para evitar que un validador de URL se quede colgado en el stream y cause Runtime Timeout
  const acceptHeader = req.headers["accept"] || "";
  if (req.method === "GET" && !acceptHeader.includes("text/event-stream") && !req.headers["sec-fetch-dest"]?.includes("eventsource")) {
    return res.status(200).json({
      status: "ok",
      name: "spark-mcp-router",
      protocol: "mcp-sse",
      version: "2.0.0",
      services: enabledServices,
    });
  }

  // 3. Manejo de conexión SSE mediante GET
  if (req.method === "GET") {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const messagesEndpoint = auth.token
      ? `/api/messages?token=${encodeURIComponent(auth.token)}`
      : "/api/messages";

    const transport = new SSEServerTransport(messagesEndpoint, res);
    const server = createMcpServer({ services: enabledServices });

    await server.connect(transport);

    const sessionId = transport.sessionId;
    sessions.set(sessionId, { transport, server });

    console.log(`[SSE] Cliente autenticado conectado. Session ID: ${sessionId}`);

    const keepAliveInterval = setInterval(() => {
      try {
        res.write(": keep-alive\n\n");
      } catch (err) {
        clearInterval(keepAliveInterval);
      }
    }, 15000);

    return new Promise((resolve) => {
      const cleanUp = () => {
        clearInterval(keepAliveInterval);
        sessions.delete(sessionId);
        console.log(`[SSE] Sesión cerrada: ${sessionId}`);
        resolve();
      };

      req.on("close", cleanUp);
      res.on("close", cleanUp);
    });
  }

  // 5. Procesar POST directo a /api/sse de forma sin estado
  if (req.method === "POST") {
    if (!req.headers["accept"] || !req.headers["accept"].includes("text/event-stream")) {
      req.headers["accept"] = "application/json, text/event-stream";
    }

    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      const server = createMcpServer({ services: enabledServices });
      await server.connect(transport);

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("[SSE POST Handler Error]:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: error.message || "Failed to process POST message in SSE endpoint.",
          },
          id: null,
        });
      }
    }
    return;
  }

  res.setHeader("Allow", ["GET", "POST", "HEAD", "OPTIONS"]);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}
