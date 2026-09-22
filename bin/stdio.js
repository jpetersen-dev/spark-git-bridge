#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "../lib/server.js";

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
