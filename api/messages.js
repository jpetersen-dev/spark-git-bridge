import { sessions } from "../lib/server.js";
import { authenticate } from "../lib/auth.js";

/**
 * Serverless handler para el endpoint de mensajes MCP con validación de seguridad.
 * Procesa peticiones HTTP POST con mensajes JSON-RPC 2.0 únicamente de emisores autorizados.
 */
export default async function handler(req, res) {
  // Configuración de CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-bridge-token, x-api-key");

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
    return; // authenticate ya envió la respuesta 401 / 500
  }

  // 2. Extraer el sessionId desde query string
  const sessionId =
    req.query?.sessionId ||
    new URL(req.url, `http://${req.headers.host}`).searchParams.get("sessionId");

  if (!sessionId) {
    return res.status(400).json({
      error: "Missing required 'sessionId' query parameter.",
    });
  }

  // 3. Buscar la sesión activa en el registro en memoria
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({
      error: `Session '${sessionId}' not found or has expired. Please re-establish the SSE connection.`,
    });
  }

  try {
    // Normalizar el body JSON
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (err) {
        return res.status(400).json({ error: "Invalid JSON body" });
      }
    }

    // 4. Procesar el mensaje JSON-RPC entrante con handleMessage
    await session.transport.handleMessage(body);

    return res.status(202).send("Accepted");
  } catch (error) {
    console.error(`[Messages] Error al procesar mensaje para la sesión ${sessionId}:`, error);
    return res.status(500).json({
      error: error.message || "An error occurred while processing the MCP message.",
    });
  }
}
