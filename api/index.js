/**
 * Endpoint raíz para verificación de estado y salud del servidor MCP.
 * Responde 200 OK inmediatamente a validadores y comprobadores de disponibilidad.
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "HEAD") {
    return res.status(200).end();
  }

  return res.status(200).json({
    name: "spark-mcp-router",
    status: "healthy",
    protocol: "mcp",
    version: "2.1.0",
    services: ["github", "telegram", "notion"],
    endpoints: {
      all: "/api/mcp/:token",
      github: "/api/mcp/github/:token",
      telegram: "/api/mcp/telegram/:token",
      notion: "/api/mcp/notion/:token",
    },
  });
}
