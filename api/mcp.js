import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createGitHubServer } from "../lib/server.js";
import { authenticate } from "../lib/auth.js";

/**
 * Serverless handler para el protocolo MCP estándar (Streamable HTTP / Stateless).
 * Soporta HEAD, GET (healthcheck o stream) y POST (JSON-RPC) para máxima compatibilidad.
 */
export default async function handler(req, res) {
  console.log(`[MCP-INCOMING] ${req.method} ${req.url}`);

  // CORS Headers completos
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-bridge-token, x-api-key, mcp-session-id, Last-Event-ID, mcp-protocol-version"
  );
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id, mcp-protocol-version");

  // Preflight OPTIONS
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Comprobación HEAD inmediata (usada por validadores de URL)
  if (req.method === "HEAD") {
    return res.status(200).end();
  }

  // 1. Verificación de seguridad
  const auth = authenticate(req, res);
  if (!auth.authenticated) {
    return;
  }

  // 2. Verificación de token de GitHub
  if (!process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
    console.error("Missing GITHUB_PERSONAL_ACCESS_TOKEN");
    return res.status(500).json({
      error: "GITHUB_PERSONAL_ACCESS_TOKEN is not configured on the server.",
    });
  }

  // 3. Comprobación de salud GET (sin Accept: text/event-stream)
  // Responde de inmediato para evitar que validadores como Gemini se queden esperando
  // en un stream abierto y sufran Runtime Timeout de Vercel.
  const acceptHeader = req.headers["accept"] || "";
  if (req.method === "GET" && !acceptHeader.includes("text/event-stream")) {
    return res.status(200).json({
      status: "ok",
      name: "spark-git-bridge",
      protocol: "mcp",
      version: "1.0.0",
      transport: "streamable-http",
    });
  }

  // Normalizar cabecera Accept para Streamable HTTP
  if (!req.headers["accept"] || !req.headers["accept"].includes("text/event-stream")) {
    req.headers["accept"] = "application/json, text/event-stream";
  }

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Sin estado para Serverless
    });

    const server = createGitHubServer();
    await server.connect(transport);

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("[MCP Streamable Error]:", error);
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
