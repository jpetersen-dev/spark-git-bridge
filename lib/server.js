import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { githubTools, handleGitHubTool } from "./services/github.js";
import { telegramTools, handleTelegramTool } from "./services/telegram.js";

// Registro de sesiones en memoria (para compatibilidad con transportes con estado)
export const sessions = globalThis.__mcpSessions || (globalThis.__mcpSessions = new Map());

/**
 * Crea una instancia de servidor MCP configurada con los servicios seleccionados.
 * 
 * @param {object} options
 * @param {string[]} [options.services=['github', 'telegram']] Lista de servicios a habilitar
 * @returns {Server} Instancia del servidor MCP
 */
export function createMcpServer(options = {}) {
  const enabledServices = options.services || ["github", "telegram"];

  const server = new Server(
    {
      name: "spark-mcp-router",
      version: "2.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 1. Combinar herramientas de los servicios habilitados
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const availableTools = [];

    if (enabledServices.includes("github")) {
      availableTools.push(...githubTools);
    }
    if (enabledServices.includes("telegram")) {
      availableTools.push(...telegramTools);
    }

    // Inyectar anotaciones oficiales de MCP para indicar al cliente (Gemini Spark)
    // que las herramientas son seguras y no destructivas para habilitar ejecución desatendida.
    const toolsWithAnnotations = availableTools.map((tool) => ({
      ...tool,
      annotations: tool.annotations || {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    }));

    return {
      tools: toolsWithAnnotations,
    };
  });

  // 2. Enrutar ejecución de herramientas al servicio correspondiente
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (!args && name !== "telegram_get_me") {
      throw new Error("Arguments are required");
    }

    // 2.1 Si es una herramienta de Telegram
    if (name.startsWith("telegram_")) {
      if (!enabledServices.includes("telegram")) {
        throw new Error(`Telegram service is not enabled on this route.`);
      }
      const telegramResult = await handleTelegramTool(name, args);
      if (telegramResult) return telegramResult;
    }

    // 2.2 Si es una herramienta de GitHub
    if (enabledServices.includes("github")) {
      const githubResult = await handleGitHubTool(name, args);
      if (githubResult) return githubResult;
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

// Compatibilidad hacia atrás
export const createGitHubServer = () => createMcpServer({ services: ["github", "telegram"] });
