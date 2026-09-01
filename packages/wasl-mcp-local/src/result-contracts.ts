import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export const MCP_ERROR_CODES = [
  "NOT_FOUND",
  "AMBIGUOUS_MATCH",
  "VALIDATION_ERROR",
  "VERSION_CONFLICT",
  "PERMISSION_DENIED",
  "RATE_LIMITED",
  "STORE_UNAVAILABLE",
  "SCHEMA_MISMATCH",
  "INTERNAL_ERROR",
] as const;

export type McpErrorCode = (typeof MCP_ERROR_CODES)[number];
export type McpRequestId = string | number;

export const MCP_RESULT_OUTPUT_SCHEMA = z.object({
  ok: z.boolean(),
  data: z.record(z.string(), z.unknown()).optional(),
  operation: z
    .object({
      action: z.string(),
      requestId: z.union([z.string(), z.number()]).optional(),
    })
    .optional(),
  error: z
    .object({
      code: z.enum(MCP_ERROR_CODES),
      message: z.string(),
      retryable: z.boolean(),
      details: z.unknown().optional(),
    })
    .optional(),
});

export interface InvalidArgumentsMarker {
  __waslInvalidArguments: true;
  issues: Array<{ code: string; message: string; path: Array<string | number> }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function withStructuredValidation<T extends z.ZodTypeAny>(schema: T) {
  if (!(schema instanceof z.ZodObject)) return schema;

  const transportShape = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => [
      key,
      (field as z.ZodTypeAny).optional(),
    ]),
  ) as z.ZodRawShape;
  return z.object(transportShape);
}

export function invalidArgumentsFromError(error: {
  issues: ReadonlyArray<{ code: string; message: string; path: ReadonlyArray<PropertyKey> }>;
}): InvalidArgumentsMarker {
  return {
    __waslInvalidArguments: true,
    issues: error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path.map((part) => (typeof part === "symbol" ? part.description ?? "symbol" : part)),
    })),
  };
}

function isReadAction(action: string): boolean {
  return action.startsWith("get_") ||
    action.startsWith("list_") ||
    action.startsWith("search_") ||
    action.endsWith("_list") ||
    action.endsWith("_search") ||
    action.endsWith("_get");
}

function entityIdFrom(data: Record<string, unknown>): string | null {
  for (const key of ["id", "restoredId", "deletedId", "trashId", "date"]) {
    const value = data[key];
    if (typeof value === "string" && value) return value;
  }

  for (const key of ["task", "note", "goal", "habit", "block", "entry", "workout", "account", "transaction"]) {
    const value = data[key];
    if (isRecord(value) && typeof value.id === "string" && value.id) return value.id;
  }
  return null;
}

function classifyError(error: unknown): {
  code: McpErrorCode;
  message: string;
  retryable: boolean;
  details?: unknown;
} {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const lower = raw.toLowerCase();

  if (lower.includes("ambiguous")) {
    return { code: "AMBIGUOUS_MATCH", message: "The reference matches multiple items.", retryable: false };
  }
  if (lower.includes("not found") || lower.includes("no active") || lower.includes("not in trash")) {
    return { code: "NOT_FOUND", message: "The requested item was not found.", retryable: false };
  }
  if (lower.includes("permission") || lower.includes("restricted") || lower.includes("revoked")) {
    return { code: "PERMISSION_DENIED", message: "This MCP client is not permitted to perform that operation.", retryable: false };
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return { code: "RATE_LIMITED", message: "The MCP request rate limit was reached.", retryable: true };
  }
  if (lower.includes("conflict") || lower.includes("concurrent") || lower.includes("retry limit")) {
    return { code: "VERSION_CONFLICT", message: "The data changed concurrently. Refresh and retry.", retryable: true };
  }
  if (lower.includes("schema") || lower.includes("migration") || lower.includes("version mismatch") || lower.includes("newer than")) {
    return { code: "SCHEMA_MISMATCH", message: "The stored data schema is not compatible with this MCP operation.", retryable: false };
  }
  if (
    lower.includes("wasl_local_offline") ||
    lower.includes("wasl_local_timeout") ||
    lower.includes("store") ||
    lower.includes("indexeddb")
  ) {
    return { code: "STORE_UNAVAILABLE", message: "WASL Local storage is temporarily unavailable.", retryable: true };
  }
  return { code: "INTERNAL_ERROR", message: "The MCP operation could not be completed.", retryable: false };
}

export function validationErrorResult(toolName: string, marker: InvalidArgumentsMarker): CallToolResult {
  return errorResult({
    code: "VALIDATION_ERROR",
    message: `Invalid arguments for tool ${toolName}.`,
    retryable: false,
    details: { issues: marker.issues },
  });
}

export function errorResult(error: unknown): CallToolResult {
  const body =
    isRecord(error) &&
    MCP_ERROR_CODES.includes(error.code as McpErrorCode) &&
    typeof error.message === "string" &&
    typeof error.retryable === "boolean"
      ? {
          code: error.code as McpErrorCode,
          message: error.message,
          retryable: error.retryable,
          ...(error.details !== undefined ? { details: error.details } : {}),
        }
      : classifyError(error);

  return {
    isError: true,
    content: [{ type: "text", text: body.message }],
    structuredContent: { ok: false, error: body },
  };
}

export function successResult(action: string, raw: unknown, requestId?: McpRequestId): CallToolResult {
  if (isRecord(raw) && raw.success === false) {
    return errorResult(typeof raw.error === "string" ? new Error(raw.error) : raw.error);
  }

  const data: Record<string, unknown> = isRecord(raw) ? { ...raw } : { value: raw };
  delete data.success;

  const structuredContent = isReadAction(action)
    ? { ok: true, data }
    : {
        ok: true,
        data: { ...data, id: entityIdFrom(data) },
        operation: {
          action,
          ...(requestId !== undefined ? { requestId } : {}),
        },
      };

  return {
    content: [
      {
        type: "text",
        text: isReadAction(action)
          ? `${action} returned structured data.`
          : `${action} completed successfully.`,
      },
    ],
    structuredContent,
  };
}
