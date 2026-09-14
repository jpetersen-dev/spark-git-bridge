import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createGitHubServer } from "../lib/server.js";
import { authenticate } from "../lib/auth.js";

/**
 * Serverless handler para el protocolo MCP estándar (Streamable HTTP / Stateless).
 * Soporta tanto solicitudes directas POST (JSON-RPC) como transmisiones continuas GET (SSE).
 * Diseñado específicamente para entornos Serverless como Vercel donde las funciones son sin estado.
 */
export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-bridge-token, x-api-key, mcp-session-id, Last-Event-ID, mcp-protocol-version"
  );
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id, mcp-protocol-version");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // 1. Verificación de seguridad del token del puente
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

  // Asegurar cabeceras Accept compatibles con MCP Streamable HTTP
  if (!req.headers["accept"] || !req.headers["accept"].includes("text/event-stream")) {
    req.headers["accept"] = "application/json, text/event-stream";
  }

  try {
    // Instanciar transporte Streamable HTTP en modo sin estado (ideal para Vercel Serverless)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    const server = createGitHubServer();
    await server.connect(transport);

    // Procesar la solicitud entrante delegando el cuerpo parseado si Vercel ya lo procesó
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("[MCP Streamable Handler Error]:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: error.message || "Internal server error in MCP bridge",
        },
        id: null,
      });
    }
  }
}
