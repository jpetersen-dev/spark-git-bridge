/**
 * Valida que la solicitud entrante contenga una clave válida para acceder al puente MCP.
 * Admite autenticación por:
 * 1. Header Authorization (Bearer ...) o x-bridge-token / x-api-key
 * 2. Query param (?token=... o ?apiKey=...)
 * 3. Segmento de ruta URL (/api/mcp/:token o /api/sse/:token)
 * 
 * @param {import('http').IncomingMessage} req 
 * @param {import('http').ServerResponse} res 
 * @returns {{ authenticated: boolean, token: string | null }}
 */
export function authenticate(req, res) {
  const secretKey = process.env.BRIDGE_AUTH_TOKEN;

  if (!secretKey) {
    console.error("[Auth] Error crítico: BRIDGE_AUTH_TOKEN no está definido en las variables de entorno.");
    res.status(500).json({
      error: "El servidor no tiene configurada la variable de seguridad BRIDGE_AUTH_TOKEN.",
    });
    return { authenticated: false, token: null };
  }

  // 1. Extraer token de encabezados HTTP
  const authHeader = req.headers["authorization"];
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const customHeader = req.headers["x-bridge-token"] || req.headers["x-api-key"];

  // 2. Extraer token de Query Params
  let queryToken = null;
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    queryToken = url.searchParams.get("token") || url.searchParams.get("apiKey");
  } catch (err) {
    queryToken = req.query?.token || req.query?.apiKey;
  }

  // 3. Extraer token de la ruta URL (por ejemplo /api/mcp/MI_TOKEN o /api/sse/MI_TOKEN)
  let pathToken = null;
  const rawPath = req.url ? req.url.split("?")[0] : "";
  const pathParts = rawPath.split("/").filter(Boolean);
  if (pathParts.length > 0) {
    const lastSegment = pathParts[pathParts.length - 1];
    if (lastSegment === secretKey) {
      pathToken = lastSegment;
    }
  }

  const providedToken = bearerToken || customHeader || queryToken || pathToken;

  if (!providedToken || providedToken !== secretKey) {
    console.warn(`[Auth] Acceso rechazado en ${req.method} ${req.url}. Headers: ${JSON.stringify(req.headers)}`);
    res.status(401).json({
      error: "No autorizado: Token de seguridad del puente MCP ausente o inválido.",
    });
    return { authenticated: false, token: null };
  }

  return { authenticated: true, token: providedToken };
}
