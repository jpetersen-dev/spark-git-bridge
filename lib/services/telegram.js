import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import fetch from "node-fetch";

if (!globalThis.fetch) {
  globalThis.fetch = fetch;
}

const BASE_TELEGRAM_URL = "https://api.telegram.org";

/**
 * Realiza peticiones a la API oficial de Telegram Bot
 */
async function telegramRequest(method, body = {}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN environment variable is not configured.");
  }

  const url = `${BASE_TELEGRAM_URL}/bot${botToken}/${method}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Telegram API Error [${data.error_code}]: ${data.description}`);
  }

  return data.result;
}

function resolveChatId(providedChatId) {
  const chatId = providedChatId || process.env.TELEGRAM_DEFAULT_CHAT_ID;
  if (!chatId) {
    throw new Error(
      "chat_id is required. Provide it as an argument or configure TELEGRAM_DEFAULT_CHAT_ID in environment variables."
    );
  }
  return chatId;
}

// Esquemas Zod para herramientas de Telegram
const SendMessageSchema = z.object({
  text: z.string().describe("Text of the message to be sent"),
  chat_id: z
    .union([z.string(), z.number()])
    .optional()
    .describe("Unique identifier for the target chat or username. Defaults to TELEGRAM_DEFAULT_CHAT_ID"),
  parse_mode: z
    .enum(["HTML", "Markdown", "MarkdownV2"])
    .optional()
    .describe("Formatting options for the message (e.g. HTML or Markdown)"),
});

const GetUpdatesSchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Limits the number of updates to be retrieved. Values between 1-100. Defaults to 10"),
  offset: z
    .number()
    .optional()
    .describe("Identifier of the first update to be returned"),
});

const SendPhotoSchema = z.object({
  photo: z.string().url().describe("Photo URL to send to the chat"),
  caption: z.string().optional().describe("Photo caption (0-1024 characters)"),
  chat_id: z
    .union([z.string(), z.number()])
    .optional()
    .describe("Target chat identifier. Defaults to TELEGRAM_DEFAULT_CHAT_ID"),
});

const GetChatSchema = z.object({
  chat_id: z
    .union([z.string(), z.number()])
    .optional()
    .describe("Unique identifier for the target chat. Defaults to TELEGRAM_DEFAULT_CHAT_ID"),
});

export const telegramTools = [
  {
    name: "telegram_send_message",
    description: "Send a text message, alert, or report to a Telegram user, group, or channel. Safe notification tool.",
    inputSchema: zodToJsonSchema(SendMessageSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "telegram_notify",
    description: "Automated status notification or background progress log to Telegram. Safe read-only reporting tool.",
    inputSchema: zodToJsonSchema(SendMessageSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "telegram_get_messages",
    description: "Retrieve recent incoming messages or updates received by the Telegram bot",
    inputSchema: zodToJsonSchema(GetUpdatesSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "telegram_send_photo",
    description: "Send an image or photo by public URL with an optional caption to Telegram",
    inputSchema: zodToJsonSchema(SendPhotoSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "telegram_get_me",
    description: "Get basic information about the Telegram bot (ID, username, status)",
    inputSchema: {
      type: "object",
      properties: {},
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "telegram_get_chat",
    description: "Get up to date information about a Telegram chat or user",
    inputSchema: zodToJsonSchema(GetChatSchema),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];

export async function handleTelegramTool(name, rawArgs) {
  try {
    switch (name) {
      case "telegram_send_message":
      case "telegram_notify": {
        const args = SendMessageSchema.parse(rawArgs || {});
        const chatId = resolveChatId(args.chat_id);
        const result = await telegramRequest("sendMessage", {
          chat_id: chatId,
          text: args.text,
          parse_mode: args.parse_mode,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message_id: result.message_id,
                  chat: result.chat,
                  date: result.date,
                },
                null,
                2
              ),
            },
          ],
        };
      }
      case "telegram_get_messages": {
        const args = GetUpdatesSchema.parse(rawArgs || {});
        const updates = await telegramRequest("getUpdates", {
          limit: args.limit || 10,
          offset: args.offset,
        });
        // Simplificar respuesta para el LLM
        const simplified = updates.map((u) => ({
          update_id: u.update_id,
          date: u.message?.date ? new Date(u.message.date * 1000).toISOString() : null,
          from: u.message?.from?.username || u.message?.from?.first_name,
          chat_id: u.message?.chat?.id,
          text: u.message?.text,
        }));
        return { content: [{ type: "text", text: JSON.stringify(simplified, null, 2) }] };
      }
      case "telegram_send_photo": {
        const args = SendPhotoSchema.parse(rawArgs || {});
        const chatId = resolveChatId(args.chat_id);
        const result = await telegramRequest("sendPhoto", {
          chat_id: chatId,
          photo: args.photo,
          caption: args.caption,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message_id: result.message_id,
                  caption: result.caption,
                },
                null,
                2
              ),
            },
          ],
        };
      }
      case "telegram_get_me": {
        const botInfo = await telegramRequest("getMe");
        return { content: [{ type: "text", text: JSON.stringify(botInfo, null, 2) }] };
      }
      case "telegram_get_chat": {
        const args = GetChatSchema.parse(rawArgs || {});
        const chatId = resolveChatId(args.chat_id);
        const chatInfo = await telegramRequest("getChat", { chat_id: chatId });
        return { content: [{ type: "text", text: JSON.stringify(chatInfo, null, 2) }] };
      }
      default:
        return null;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid Telegram tool input: ${JSON.stringify(error.errors)}`);
    }
    throw error;
  }
}
