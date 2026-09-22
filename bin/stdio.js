#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "../lib/server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env");

if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(envPath);
  } catch (err) {
    // ignore
  }
}

if (!process.env.NOTION_API_KEY) {
  try {
    const homeDir = process.env.USERPROFILE || process.env.HOME || "";
    const mcpConfigPath = path.join(homeDir, ".gemini", "config", "mcp_config.json");
    if (fs.existsSync(mcpConfigPath)) {
      const config = JSON.parse(fs.readFileSync(mcpConfigPath, "utf-8"));
      if (config?.mcpServers?.notion?.env?.NOTION_API_KEY) {
        process.env.NOTION_API_KEY = config.mcpServers.notion.env.NOTION_API_KEY;
      }
    }
  } catch (err) {
    // ignore
  }
}

async function main() {
  const servicesArg = process.env.MCP_SERVICES
    ? process.env.MCP_SERVICES.split(",").map((s) => s.trim())
    : ["notion"];

  const server = createMcpServer({ services: servicesArg });
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error in MCP stdio server:", error);
  process.exit(1);
});
