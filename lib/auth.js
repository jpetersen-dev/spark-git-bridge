/**
 * Valida que la solicitud entrante contenga una clave válida para acceder al puente MCP.
 * Admite autenticación por Header (Bearer o x-api-key) y por Query Param (?token= o ?apiKey=).
 * 
 * @param {import('http').IncomingMessage} req 
 * @param {import('http').ServerResponse} res 
 * @returns {{ authenticated: boolean, token: string | null }}
 */
export function authenticate(req, res) {
  const secretKey = process.env.BRIDGE_AUTH_TOKEN;

  // Si no se ha configurado la variable de entorno, se bloquea por defecto por seguridad
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
    // Si falla el parseo de URL, intenta leer req.query (proporcionado por Vercel)
    queryToken = req.query?.token || req.query?.apiKey;
  }

  const providedToken = bearerToken || customHeader || queryToken;

  // 3. Comparación en tiempo constante o igualdad estricta
  if (!providedToken || providedToken !== secretKey) {
    console.warn("[Auth] Intento de acceso no autorizado rechazado.");
    res.status(401).json({
      error: "No autorizado: Token de seguridad del puente MCP ausente o inválido.",
    });
    return { authenticated: false, token: null };
  }

  return { authenticated: true, token: providedToken };
}
