#!/usr/bin/env node
/**
 * packages/wasl-mcp-local/src/cli.ts
 *
 * Direct STDIO Model Context Protocol server for WASL Local Edition.
 *
 * Usage:
 *   npx wasl-mcp-local --secret=<connector_secret> [--port=42424]
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { LoopbackBridge } from "./loopback-bridge.js";
import { WASL_TOOLS } from "./tool-definitions.js";
import {
  MCP_RESULT_OUTPUT_SCHEMA,
  errorResult,
  invalidArgumentsFromError,
  successResult,
  validationErrorResult,
  withStructuredValidation,
} from "./result-contracts.js";

function parseArgs(): { secret?: string; port?: number; allowedOrigins?: string } {
  const args = process.argv.slice(2);
  let secret: string | undefined = process.env.WASL_CONNECTOR_SECRET;
  let port: number | undefined = process.env.WASL_MCP_PORT ? Number(process.env.WASL_MCP_PORT) : undefined;
  let allowedOrigins: string | undefined = process.env.WASL_ALLOWED_ORIGINS;

  for (const arg of args) {
    if (arg.startsWith("--secret=")) {
      secret = arg.slice(9);
    } else if (arg.startsWith("--port=")) {
      port = Number(arg.slice(7));
    } else if (arg.startsWith("--origins=")) {
      allowedOrigins = arg.slice(10);
    } else if (arg.startsWith("--allowed-origins=")) {
      allowedOrigins = arg.slice(18);
    }
  }

  return { secret, port, allowedOrigins };
}

async function main() {
  const { secret, port, allowedOrigins } = parseArgs();

  if (!secret) {
    console.error(
      "[WASL Local MCP] Refusing to start without a connector secret. " +
        "Pass --secret=<connector_secret> (Settings → Local Storage & Connector in the WASL app).",
    );
    process.exit(1);
  }

  // Create loopback bridge
  const bridge = new LoopbackBridge({ secret, port, allowedOrigins });
  await bridge.start();

  // Create official McpServer
  const server = new McpServer({
    name: "wasl-local",
    version: "0.1.0",
  });

  // Register all WASL local tools
  for (const toolDef of WASL_TOOLS) {
    const inputSchema = withStructuredValidation(toolDef.schema);
    server.registerTool(
      toolDef.name,
      {
        description: toolDef.description,
        inputSchema,
        outputSchema: MCP_RESULT_OUTPUT_SCHEMA,
      },
      async (args, extra) => {
        const parsed = toolDef.schema.safeParse(args);
        if (!parsed.success) {
          return validationErrorResult(toolDef.name, invalidArgumentsFromError(parsed.error));
        }

        const outcome = await bridge.executeToolCall(toolDef.name, parsed.data);
        if (!outcome.ok) {
          return errorResult(
            new Error(outcome.error ?? "WASL_LOCAL_OFFLINE: WASL Local PWA is offline."),
          );
        }

        return successResult(toolDef.name, outcome.result, extra.requestId);
      },
    );
  }

  // Connect STDIO transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  let isCleaningUp = false;
  const cleanup = () => {
    if (isCleaningUp) return;
    isCleaningUp = true;
    console.error("[WASL Local MCP] Shutting down bridge and exiting...");
    bridge
      .close()
      .catch(() => {})
      .finally(() => {
        process.exit(0);
      });
  };

  process.stdin.on("end", cleanup);
  process.stdin.on("close", cleanup);
  process.stdin.on("error", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("disconnect", cleanup);
}

main().catch((err) => {
  console.error("[WASL Local MCP] Fatal error:", err);
  process.exit(1);
});
