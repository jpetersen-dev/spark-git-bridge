import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import fetch from "node-fetch";

if (!globalThis.fetch) {
  globalThis.fetch = fetch;
}

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

/**
 * Normaliza y extrae un ID de 32 caracteres de Notion (admite IDs con/sin guiones y URLs completas de Notion).
 */
function cleanNotionId(idOrUrl) {
  if (!idOrUrl) return "";
  const cleaned = idOrUrl.trim();
  const match = cleaned.match(/([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return match ? match[0].replace(/-/g, "") : cleaned;
}

/**
 * Cliente HTTP REST para la API oficial de Notion
 */
async function notionRequest(endpoint, method = "GET", body = null) {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error(
      "NOTION_API_KEY is not configured in environment variables. Add it to Vercel Project Settings > Environment Variables."
    );
  }

  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  const url = `${NOTION_API_BASE}/${cleanEndpoint}`;

  const options = {
    method,
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
  };

  if (body && (method === "POST" || method === "PATCH" || method === "PUT")) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.message || JSON.stringify(data);
    throw new Error(`Notion API Error [${response.status}]: ${errorMsg}`);
  }

  return data;
}

/**
 * Extrae texto plano de un bloque de Notion
 */
function extractBlockText(block) {
  const type = block.type;
  const content = block[type];
  if (!content) return "";

  if (Array.isArray(content.rich_text)) {
    return content.rich_text.map((t) => t.plain_text || "").join("");
  }
  return "";
}

// ==========================================
// Esquemas Zod para Herramientas de Notion
// ==========================================

const SearchSchema = z.object({
  query: z.string().optional().describe("Text query to search for page or database titles"),
  filter_type: z
    .enum(["page", "database"])
    .optional()
    .describe("Filter results by object type: 'page' or 'database'"),
  limit: z.number().min(1).max(100).optional().describe("Maximum number of results to return (1-100, default 20)"),
});

const GetPageSchema = z.object({
  page_id: z.string().describe("The ID or URL of the Notion page to retrieve"),
});

const GetPageContentSchema = z.object({
  page_id: z.string().describe("The ID or URL of the Notion page (or block) whose content blocks should be fetched"),
  limit: z.number().min(1).max(100).optional().describe("Number of blocks to retrieve (default 100)"),
});

const CreatePageSchema = z.object({
  parent_id: z.string().describe("The ID or URL of the parent database or parent page"),
  parent_type: z
    .enum(["database_id", "page_id"])
    .optional()
    .describe("Type of parent: 'database_id' (default if adding to database) or 'page_id'"),
  title: z.string().describe("The title of the new page"),
  content_text: z
    .string()
    .optional()
    .describe("Plain text or Markdown paragraphs to populate the page body. Multiple paragraphs separated by double newline."),
  properties: z
    .record(z.any())
    .optional()
    .describe("Optional advanced Notion properties object conforming to the database schema"),
});

const AppendBlocksSchema = z.object({
  page_id: z.string().describe("The ID or URL of the page or block to append content to"),
  content_text: z
    .string()
    .optional()
    .describe("Text content to append. Lines starting with '- ' or '* ' become bullet lists, '# ' become headings, others paragraphs."),
  children: z
    .array(z.record(z.any()))
    .optional()
    .describe("Optional raw array of Notion block objects if granular control is needed"),
});

const UpdatePagePropertiesSchema = z.object({
  page_id: z.string().describe("The ID or URL of the Notion page to update"),
  properties: z.record(z.any()).describe("Notion properties object with updated values"),
  archived: z.boolean().optional().describe("Set to true to archive (delete) or false to unarchive"),
});

const QueryDatabaseSchema = z.object({
  database_id: z.string().describe("The ID or URL of the Notion database to query"),
  filter: z.record(z.any()).optional().describe("Optional Notion filter object (e.g. status, date, select filters)"),
  sorts: z.array(z.record(z.any())).optional().describe("Optional array of Notion sort objects"),
  limit: z.number().min(1).max(100).optional().describe("Maximum number of rows/pages to return (default 50)"),
});

const GetDatabaseSchema = z.object({
  database_id: z.string().describe("The ID or URL of the Notion database to inspect schema"),
});

// ==========================================
// Definición de Herramientas MCP para Notion
// ==========================================

const safeAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export const notionTools = [
  {
    name: "notion_search",
    description: "Search for pages and databases in your Notion workspace by title or keyword. Safe query tool.",
    inputSchema: zodToJsonSchema(SearchSchema),
    annotations: safeAnnotations,
  },
  {
    name: "notion_get_page",
    description: "Retrieve metadata, title, and properties of a specific Notion page by ID or URL. Safe read tool.",
    inputSchema: zodToJsonSchema(GetPageSchema),
    annotations: safeAnnotations,
  },
  {
    name: "notion_get_page_content",
    description: "Fetch the text and block contents (paragraphs, headings, lists) of a Notion page. Safe read tool.",
    inputSchema: zodToJsonSchema(GetPageContentSchema),
    annotations: safeAnnotations,
  },
  {
    name: "notion_create_page",
    description: "Create a new page in a Notion database or under a parent page with a title and content body.",
    inputSchema: zodToJsonSchema(CreatePageSchema),
    annotations: safeAnnotations,
  },
  {
    name: "notion_append_blocks",
    description: "Append new paragraphs, bullet lists, or headings to an existing Notion page.",
    inputSchema: zodToJsonSchema(AppendBlocksSchema),
    annotations: safeAnnotations,
  },
  {
    name: "notion_update_page_properties",
    description: "Update properties (status, tags, select fields, title) or archive state of an existing Notion page.",
    inputSchema: zodToJsonSchema(UpdatePagePropertiesSchema),
    annotations: safeAnnotations,
  },
  {
    name: "notion_query_database",
    description: "Query and filter records/rows in a Notion database. Safe query tool.",
    inputSchema: zodToJsonSchema(QueryDatabaseSchema),
    annotations: safeAnnotations,
  },
  {
    name: "notion_get_database",
    description: "Retrieve database schema, columns, property names, and types of a Notion database. Safe read tool.",
    inputSchema: zodToJsonSchema(GetDatabaseSchema),
    annotations: safeAnnotations,
  },
];

// ==========================================
// Ejecución de Herramientas de Notion
// ==========================================

export async function handleNotionTool(name, rawArgs) {
  try {
    switch (name) {
      case "notion_search": {
        const args = SearchSchema.parse(rawArgs || {});
        const body = {
          page_size: args.limit || 20,
        };
        if (args.query) body.query = args.query;
        if (args.filter_type) {
          body.filter = { value: args.filter_type, property: "object" };
        }

        const data = await notionRequest("search", "POST", body);
        const results = (data.results || []).map((item) => {
          let title = "Untitled";
          if (item.object === "page") {
            const titleProp = Object.values(item.properties || {}).find((p) => p.type === "title");
            if (titleProp?.title?.length > 0) {
              title = titleProp.title.map((t) => t.plain_text).join("");
            }
          } else if (item.object === "database") {
            title = (item.title || []).map((t) => t.plain_text).join("") || "Untitled Database";
          }
          return {
            id: item.id,
            object: item.object,
            title,
            url: item.url,
            created_time: item.created_time,
            last_edited_time: item.last_edited_time,
          };
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ total: results.length, results }, null, 2),
            },
          ],
        };
      }

      case "notion_get_page": {
        const args = GetPageSchema.parse(rawArgs || {});
        const pageId = cleanNotionId(args.page_id);
        const page = await notionRequest(`pages/${pageId}`, "GET");
        return {
          content: [{ type: "text", text: JSON.stringify(page, null, 2) }],
        };
      }

      case "notion_get_page_content": {
        const args = GetPageContentSchema.parse(rawArgs || {});
        const blockId = cleanNotionId(args.page_id);
        const limit = args.limit || 100;

        const data = await notionRequest(`blocks/${blockId}/children?page_size=${limit}`, "GET");
        const blocks = data.results || [];

        const simplified = blocks.map((b) => ({
          id: b.id,
          type: b.type,
          text: extractBlockText(b),
          has_children: b.has_children,
        }));

        const readableText = simplified
          .map((b) => {
            if (b.type.startsWith("heading_")) return `\n# ${b.text}`;
            if (b.type === "bulleted_list_item") return `• ${b.text}`;
            if (b.type === "numbered_list_item") return `1. ${b.text}`;
            if (b.type === "to_do") return `[ ] ${b.text}`;
            return b.text;
          })
          .filter(Boolean)
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  readable_text: readableText,
                  blocks: simplified,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "notion_create_page": {
        const args = CreatePageSchema.parse(rawArgs || {});
        const cleanParentId = cleanNotionId(args.parent_id);

        let parent;
        if (args.parent_type === "page_id") {
          parent = { page_id: cleanParentId };
        } else {
          // Por defecto asumir database_id salvo que se especifique page_id
          parent = { database_id: cleanParentId };
        }

        let properties = args.properties || {};
        // Si no se proveyó objeto avanzado de propiedades, generar la propiedad de título
        if (!properties.Name && !properties.title && !properties.Title && !properties["Nombre"]) {
          properties.title = {
            title: [{ type: "text", text: { content: args.title } }],
          };
        }

        let children = [];
        if (args.content_text) {
          const paragraphs = args.content_text.split(/\n\n+/);
          children = paragraphs.map((p) => ({
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: p } }],
            },
          }));
        }

        const body = {
          parent,
          properties,
        };
        if (children.length > 0) {
          body.children = children;
        }

        const createdPage = await notionRequest("pages", "POST", body);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  id: createdPage.id,
                  url: createdPage.url,
                  created_time: createdPage.created_time,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "notion_append_blocks": {
        const args = AppendBlocksSchema.parse(rawArgs || {});
        const blockId = cleanNotionId(args.page_id);

        let children = args.children || [];
        if (args.content_text && children.length === 0) {
          const lines = args.content_text.split("\n");
          children = lines
            .map((line) => {
              const trimmed = line.trim();
              if (!trimmed) return null;
              if (trimmed.startsWith("# ")) {
                return {
                  object: "block",
                  type: "heading_1",
                  heading_1: { rich_text: [{ type: "text", text: { content: trimmed.slice(2) } }] },
                };
              }
              if (trimmed.startsWith("## ")) {
                return {
                  object: "block",
                  type: "heading_2",
                  heading_2: { rich_text: [{ type: "text", text: { content: trimmed.slice(3) } }] },
                };
              }
              if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                return {
                  object: "block",
                  type: "bulleted_list_item",
                  bulleted_list_item: { rich_text: [{ type: "text", text: { content: trimmed.slice(2) } }] },
                };
              }
              return {
                object: "block",
                type: "paragraph",
                paragraph: { rich_text: [{ type: "text", text: { content: trimmed } }] },
              };
            })
            .filter(Boolean);
        }

        const result = await notionRequest(`blocks/${blockId}/children`, "PATCH", { children });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  appended_blocks_count: result.results?.length || children.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "notion_update_page_properties": {
        const args = UpdatePagePropertiesSchema.parse(rawArgs || {});
        const pageId = cleanNotionId(args.page_id);
        const body = {
          properties: args.properties,
        };
        if (typeof args.archived === "boolean") {
          body.archived = args.archived;
        }

        const updated = await notionRequest(`pages/${pageId}`, "PATCH", body);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  id: updated.id,
                  url: updated.url,
                  last_edited_time: updated.last_edited_time,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "notion_query_database": {
        const args = QueryDatabaseSchema.parse(rawArgs || {});
        const databaseId = cleanNotionId(args.database_id);

        const body = {
          page_size: args.limit || 50,
        };
        if (args.filter) body.filter = args.filter;
        if (args.sorts) body.sorts = args.sorts;

        const data = await notionRequest(`databases/${databaseId}/query`, "POST", body);
        const rows = (data.results || []).map((page) => {
          let title = "Untitled";
          const titleProp = Object.values(page.properties || {}).find((p) => p.type === "title");
          if (titleProp?.title?.length > 0) {
            title = titleProp.title.map((t) => t.plain_text).join("");
          }

          return {
            id: page.id,
            title,
            url: page.url,
            properties: page.properties,
            created_time: page.created_time,
          };
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ total: rows.length, has_more: data.has_more, rows }, null, 2),
            },
          ],
        };
      }

      case "notion_get_database": {
        const args = GetDatabaseSchema.parse(rawArgs || {});
        const databaseId = cleanNotionId(args.database_id);
        const database = await notionRequest(`databases/${databaseId}`, "GET");
        return {
          content: [{ type: "text", text: JSON.stringify(database, null, 2) }],
        };
      }

      default:
        return null;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid Notion tool input: ${JSON.stringify(error.errors)}`);
    }
    throw error;
  }
}
