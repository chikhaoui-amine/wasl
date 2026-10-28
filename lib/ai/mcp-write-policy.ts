import type { StoreKey } from "@/lib/data/store-registry";
import { MCP_DEPRECATED_TOOLS } from "@/packages/wasl-mcp-local/src/tool-catalog";

export const MCP_DOMAINS = [
  "tasks", "notes", "goals", "habits", "blocks", "journal",
  "money", "health", "recurring", "topics", "trash",
] as const;

export type McpDomain = (typeof MCP_DOMAINS)[number];
export type McpPermission = "read" | "read_write";

const DOMAIN_STORES: Record<McpDomain, StoreKey> = {
  tasks: "lifeos-tasks",
  notes: "lifeos-notes",
  goals: "lifeos-goals",
  habits: "lifeos-habits",
  blocks: "lifeos-blocks",
  journal: "lifeos-journal",
  money: "lifeos-money",
  health: "lifeos-health",
  recurring: "lifeos-recurring",
  topics: "lifeos-topics",
  trash: "lifeos-trash",
};

const READ_PREFIXES = ["get_", "list_", "search_"];

export function isMcpWriteTool(toolName: string): boolean {
  return !(
    READ_PREFIXES.some((prefix) => toolName.startsWith(prefix)) ||
    toolName.endsWith("_list") ||
    toolName.endsWith("_search") ||
    toolName.endsWith("_get") ||
    toolName === "mcp_capabilities"
  );
}

export function mcpToolDomain(toolName: string): McpDomain {
  if (toolName.includes("note")) return "notes";
  if (toolName.includes("topic")) return "topics";
  if (toolName.includes("money") || toolName.includes("transaction") || toolName.includes("saving") || toolName.includes("account")) return "money";
  if (toolName.includes("goal") || toolName.includes("milestone")) return "goals";
  if (toolName.includes("habit")) return "habits";
  if (toolName.includes("block") || toolName.includes("calendar")) return "blocks";
  if (toolName.includes("journal")) return "journal";
  if (toolName.includes("health") || toolName.includes("workout") || toolName.includes("exercise") || toolName.includes("program") || toolName.startsWith("log_sleep") || toolName.startsWith("log_weight")) return "health";
  if (toolName.includes("recurring")) return "recurring";
  if (toolName.includes("trash") || toolName.startsWith("restore_")) return "trash";
  return "tasks";
}

export function mcpToolStore(toolName: string): StoreKey {
  return DOMAIN_STORES[mcpToolDomain(toolName)];
}

export function destructiveConfirmation(toolName: string, args: Record<string, unknown> = {}): string | undefined {
  switch (toolName) {
    case "trash_delete_permanently": return "PERMANENTLY_DELETE";
    case "trash_empty": return "EMPTY_TRASH";
    case "active_workout_discard": return "DISCARD_ACTIVE_WORKOUT";
    default: {
      if (!toolName.endsWith("_delete")) return undefined;
      for (const key of ["id", "noteId", "resourceId", "substepId", "stepId", "milestoneId"]) {
        if (typeof args[key] === "string" && args[key]) return `DELETE:${args[key]}`;
      }
      return "CONFIRM_DELETE";
    }
  }
}

export function safeCapabilityMetadata(input: {
  permission: McpPermission;
  allowedDomains: readonly string[];
}) {
  const allowedDomains = MCP_DOMAINS.filter((domain) => input.allowedDomains.includes(domain));
  return {
    permission: input.permission,
    allowedDomains,
    canWrite: input.permission === "read_write",
    deprecatedTools: MCP_DEPRECATED_TOOLS,
    mutationSafety: {
      immutableIdsRequired: true,
      optimisticConcurrency: { field: "expectedVersion", token: "store updatedAt" },
      idempotency: { field: "idempotencyKey", supportedForAllWrites: true },
      permanentDestruction: {
        field: "confirmation",
        requiredValues: {
          trash_delete_permanently: "PERMANENTLY_DELETE",
          trash_empty: "EMPTY_TRASH",
          active_workout_discard: "DISCARD_ACTIVE_WORKOUT",
        },
        entityDeletePattern: "DELETE:<immutable-id>",
      },
      auditLogging: true,
    },
  };
}
