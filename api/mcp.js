import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "../lib/server.js";
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
 * Serverless handler para el protocolo MCP estándar (Streamable HTTP / Stateless).
 * Soporta HEAD, GET (healthcheck o stream) y POST (JSON-RPC).
 * Enruta dinámicamente servicios (GitHub, Telegram o Ambos).
 */
export default async function handler(req, res) {
  console.log(`[MCP-ROUTER] ${req.method} ${req.url}`);

  // CORS Headers completos
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

  if (req.method === "HEAD") {
    return res.status(200).end();
  }

  // 1. Verificación de seguridad
  const auth = authenticate(req, res);
  if (!auth.authenticated) {
    return;
  }

  const enabledServices = resolveServices(req);

  // 2. Comprobación de salud GET (sin Accept: text/event-stream)
  const acceptHeader = req.headers["accept"] || "";
  if (req.method === "GET" && !acceptHeader.includes("text/event-stream")) {
    return res.status(200).json({
      status: "ok",
      name: "spark-mcp-router",
      protocol: "mcp",
      version: "2.0.0",
      services: enabledServices,
      transport: "streamable-http",
    });
  }

  // Normalizar cabecera Accept para Streamable HTTP
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
    console.error("[MCP Router Error]:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: error.message || "Internal server error in MCP router",
        },
        id: null,
      });
    }
  }
}
