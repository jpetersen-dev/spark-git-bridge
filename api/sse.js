import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createGitHubServer, sessions } from "../lib/server.js";
import { authenticate } from "../lib/auth.js";

/**
 * Serverless handler para el endpoint SSE de MCP con capa de seguridad.
 * Establece el stream SSE únicamente para clientes autorizados y soporta POST directo.
 */
export default async function handler(req, res) {
  // Configuración de CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-bridge-token, x-api-key, mcp-session-id, Last-Event-ID, mcp-protocol-version"
  );
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id, mcp-protocol-version");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // 1. Verificación de seguridad del puente (Token secreto)
  const auth = authenticate(req, res);
  if (!auth.authenticated) {
    return;
  }

  // 2. Validación de presencia del token de GitHub
  if (!process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
    console.error("Missing GITHUB_PERSONAL_ACCESS_TOKEN environment variable");
    return res.status(500).json({
      error: "GITHUB_PERSONAL_ACCESS_TOKEN environment variable is not configured on the server.",
    });
  }

  // 3. Manejo de conexión SSE mediante GET
  if (req.method === "GET") {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // Inyectamos el token en la URL de retorno para que el cliente continúe autenticado en cada POST
    const messagesEndpoint = auth.token
      ? `/api/messages?token=${encodeURIComponent(auth.token)}`
      : "/api/messages";

    const transport = new SSEServerTransport(messagesEndpoint, res);
    const server = createGitHubServer();

    // Conectar el servidor MCP al transporte
    await server.connect(transport);

    const sessionId = transport.sessionId;
    sessions.set(sessionId, { transport, server });

    console.log(`[SSE] Cliente autenticado conectado. Session ID: ${sessionId}`);

    // Keep-alive periódico cada 15s para evitar cortes de conexión
    const keepAliveInterval = setInterval(() => {
      try {
        res.write(": keep-alive\n\n");
      } catch (err) {
        clearInterval(keepAliveInterval);
      }
    }, 15000);

    // Mantiene la Serverless Function activa mientras el stream esté abierto
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

  // 4. Procesar POST directo a /api/sse de forma sin estado (Stateless Streamable HTTP)
  if (req.method === "POST") {
    if (!req.headers["accept"] || !req.headers["accept"].includes("text/event-stream")) {
      req.headers["accept"] = "application/json, text/event-stream";
    }

    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      const server = createGitHubServer();
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

  res.setHeader("Allow", ["GET", "POST", "OPTIONS"]);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}
