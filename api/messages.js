import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { sessions, createGitHubServer } from "../lib/server.js";
import { authenticate } from "../lib/auth.js";

/**
 * Serverless handler para el endpoint de mensajes MCP.
 * Si la sesión existe en memoria local, despacha mediante handleMessage.
 * Si la sesión se encuentra en otra instancia Serverless, procesa el mensaje de forma
 * sin estado (stateless) para evitar errores 404 cross-container en Vercel.
 */
export default async function handler(req, res) {
  // Configuración de CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-bridge-token, x-api-key, mcp-session-id, Last-Event-ID, mcp-protocol-version"
  );
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id, mcp-protocol-version");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST", "OPTIONS"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // 1. Verificación de seguridad del token del puente
  const auth = authenticate(req, res);
  if (!auth.authenticated) {
    return;
  }

  // 2. Extraer el sessionId desde query string (si está presente)
  const sessionId =
    req.query?.sessionId ||
    new URL(req.url, `http://${req.headers.host}`).searchParams.get("sessionId");

  // Si existe en el almacén local de esta instancia, procesarlo por transporte SSE
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    try {
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch (err) {
          return res.status(400).json({ error: "Invalid JSON body" });
        }
      }
      await session.transport.handleMessage(body);
      return res.status(202).send("Accepted");
    } catch (error) {
      console.error(`[Messages] Error en sesión ${sessionId}:`, error);
    }
  }

  // 3. Respaldo sin estado (Stateless Fallback para Serverless):
  // Si la petición llega a un contenedor nuevo de Vercel, procesamos el mensaje directamente
  // garantizando una respuesta inmediata sin fallos de 404 por memoria aislada.
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
    console.error("[Messages Stateless Handler Error]:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: error.message || "Failed to process message in serverless function.",
        },
        id: null,
      });
    }
  }
}
