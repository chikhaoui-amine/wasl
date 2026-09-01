/**
 * lib/relay/audit.ts
 *
 * Local audit log for MCP tool invocations.
 *
 * PRIVACY GUARANTEE:
 * - Logs metadata only: client, toolName, domain, timestamp, outcome, duration.
 * - NEVER logs full sensitive payloads, notes text, financial data, or tokens.
 * - Kept in browser storage (sliding window max 100 entries).
 */

export interface McpAuditEntry {
  id: string;
  clientId: string;
  clientName: string;
  toolName: string;
  domain: string;
  timestamp: string; // ISO string
  outcome: "success" | "denied" | "error";
  durationMs: number;
  errorMessage?: string;
  requestId?: string;
  entityId?: string;
  version?: string;
  idempotencyHash?: string;
}

const AUDIT_STORAGE_KEY = "wasl_mcp_audit_log";
const MAX_AUDIT_ENTRIES = 100;
const IDEMPOTENCY_STORAGE_KEY = "wasl_mcp_idempotency_keys";

export interface LocalIdempotencyRecord {
  keyHash: string;
  requestHash: string;
  status: "pending" | "completed";
  result?: unknown;
  createdAt: string;
}

const inMemoryIdempotency = new Map<string, LocalIdempotencyRecord>();

function loadIdempotencyRecords(): LocalIdempotencyRecord[] {
  if (typeof window === "undefined" || !window.localStorage) return [...inMemoryIdempotency.values()];
  try {
    const parsed = JSON.parse(localStorage.getItem(IDEMPOTENCY_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveIdempotencyRecords(records: LocalIdempotencyRecord[]): void {
  inMemoryIdempotency.clear();
  for (const record of records.slice(-200)) inMemoryIdempotency.set(record.keyHash, record);
  if (typeof window !== "undefined" && window.localStorage) {
    localStorage.setItem(IDEMPOTENCY_STORAGE_KEY, JSON.stringify([...inMemoryIdempotency.values()]));
  }
}

export function getLocalIdempotency(keyHash: string): LocalIdempotencyRecord | undefined {
  return loadIdempotencyRecords().find((record) => record.keyHash === keyHash);
}

export function reserveLocalIdempotency(keyHash: string, requestHash: string): boolean {
  const records = loadIdempotencyRecords();
  if (records.some((record) => record.keyHash === keyHash)) return false;
  records.push({ keyHash, requestHash, status: "pending", createdAt: new Date().toISOString() });
  saveIdempotencyRecords(records);
  return true;
}

export function completeLocalIdempotency(keyHash: string, result: unknown): void {
  saveIdempotencyRecords(loadIdempotencyRecords().map((record) =>
    record.keyHash === keyHash ? { ...record, status: "completed", result } : record,
  ));
}

export function releaseLocalIdempotency(keyHash: string): void {
  saveIdempotencyRecords(loadIdempotencyRecords().filter((record) => record.keyHash !== keyHash));
}

export function loadAuditLog(): McpAuditEntry[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return inMemoryLog;
  }
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return inMemoryLog;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : inMemoryLog;
  } catch {
    return inMemoryLog;
  }
}

const inMemoryLog: McpAuditEntry[] = [];

export function recordAuditEntry(entry: McpAuditEntry): void {
  inMemoryLog.unshift(entry);
  if (inMemoryLog.length > MAX_AUDIT_ENTRIES) {
    inMemoryLog.length = MAX_AUDIT_ENTRIES;
  }

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const existing = loadAuditLog();
      const updated = [entry, ...existing.filter((e) => e.id !== entry.id)].slice(0, MAX_AUDIT_ENTRIES);
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore storage quota error
    }
  }
}

export function clearAuditLog(): void {
  inMemoryLog.length = 0;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.removeItem(AUDIT_STORAGE_KEY);
      localStorage.removeItem(IDEMPOTENCY_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  inMemoryIdempotency.clear();
}
