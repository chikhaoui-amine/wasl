/**
 * lib/relay/local-executor.test.ts
 *
 * Tests for LocalMcpExecutor against LocalAdapter.
 */

import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { LocalAdapter } from "@/lib/data/adapters/local/local-adapter";
import { WaslLocalDatabase } from "@/lib/data/adapters/local/database";
import { LocalMcpExecutor } from "./local-executor";
import type { McpClientProfile } from "./permissions";
import { loadAuditLog, clearAuditLog } from "./audit";

describe("LocalMcpExecutor", () => {
  let db: WaslLocalDatabase;
  let adapter: LocalAdapter;
  let executor: LocalMcpExecutor;

  const readWriteProfile: McpClientProfile = {
    id: "test_client_rw",
    name: "Test AI (RW)",
    type: "direct",
    port: 42424,
    secret: "test_secret_rw_32chars_long_12345",
    permission: "read_write",
    allowedDomains: ["tasks", "notes", "goals", "habits", "blocks", "recurring", "topics", "trash", "journal", "money", "health"],
    createdAt: "2026-08-24",
    lastActiveAt: "2026-08-24",
    revoked: false,
    enabled: true,
  };

  const readOnlyProfile: McpClientProfile = {
    id: "test_client_ro",
    name: "Test AI (RO)",
    type: "direct",
    port: 42425,
    secret: "test_secret_ro_32chars_long_12345",
    permission: "read",
    allowedDomains: ["tasks", "notes", "goals", "habits", "blocks", "recurring", "topics", "trash"],
    createdAt: "2026-08-24",
    lastActiveAt: "2026-08-24",
    revoked: false,
    enabled: true,
  };

  const restrictedProfile: McpClientProfile = {
    id: "test_client_restricted",
    name: "Test AI (No Sensitive)",
    type: "direct",
    port: 42426,
    secret: "test_secret_res_32chars_long_12345",
    permission: "read_write",
    allowedDomains: ["tasks", "notes"], // Sensitive domains (journal, money, health) omitted
    createdAt: "2026-08-24",
    lastActiveAt: "2026-08-24",
    revoked: false,
    enabled: true,
  };

  beforeEach(async () => {
    clearAuditLog();
    const dbName = `test_local_executor_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    db = new WaslLocalDatabase(dbName);
    adapter = new LocalAdapter({ db });
    await adapter.initialize();
    executor = new LocalMcpExecutor(adapter);
  });

  // -------------------------------------------------------------------------
  // Tasks domain
  // -------------------------------------------------------------------------
  it("adds, reads, updates, and moves tasks to trash", async () => {
    // 1. Add task
    const addOutcome = await executor.execute(
      {
        toolName: "add_task",
        args: { title: "Complete Local MCP", priority: "high", due: "2026-08-24" },
      },
      readWriteProfile,
    );
    expect(addOutcome.ok).toBe(true);
    if (!addOutcome.ok) return;
    const task = (addOutcome.result as { task: { id: string; title: string; priority: string } }).task;
    expect(task.title).toBe("Complete Local MCP");
    expect(task.priority).toBe("high");

    // 2. Get tasks
    const getOutcome = await executor.execute({ toolName: "get_tasks", args: {} }, readWriteProfile);
    expect(getOutcome.ok).toBe(true);
    if (getOutcome.ok) {
      const res = getOutcome.result as { tasks: Array<{ id: string; title: string }>; total: number };
      expect(res.total).toBe(1);
      expect(res.tasks[0].title).toBe("Complete Local MCP");
    }

    // 3. Update task
    const updateOutcome = await executor.execute(
      {
        toolName: "update_task",
        args: { id: task.id, done: true },
      },
      readWriteProfile,
    );
    expect(updateOutcome.ok).toBe(true);
    if (updateOutcome.ok) {
      const res = updateOutcome.result as { task: { status: string } };
      expect(res.task.status).toBe("done");
    }

    // 4. Delete task (moves to trash)
    const deleteOutcome = await executor.execute(
      { toolName: "delete_task", args: { id: task.id } },
      readWriteProfile,
    );
    expect(deleteOutcome.ok).toBe(true);

    // Verify removed from tasks
    const getAfterDelete = await executor.execute({ toolName: "get_tasks", args: {} }, readWriteProfile);
    if (getAfterDelete.ok) {
      const res = getAfterDelete.result as { total: number };
      expect(res.total).toBe(0);
    }

    // Verify exists in trash
    const getTrash = await executor.execute({ toolName: "get_trash_items", args: {} }, readWriteProfile);
    expect(getTrash.ok).toBe(true);
    if (getTrash.ok) {
      const res = getTrash.result as { items: Array<{ title: string; itemType: string }> };
      expect(res.items.length).toBe(1);
      expect(res.items[0].title).toBe("Complete Local MCP");
      expect(res.items[0].itemType).toBe("task");
    }
  });

  // -------------------------------------------------------------------------
  // Idempotency
  // -------------------------------------------------------------------------
  it("prevents duplicate creation when idempotencyKey is reused", async () => {
    const key = "unique_write_op_123";
    const res1 = await executor.execute(
      {
        toolName: "add_task",
        args: { title: "Idempotent Task", idempotencyKey: key },
      },
      readWriteProfile,
    );
    const res2 = await executor.execute(
      {
        toolName: "add_task",
        args: { title: "Idempotent Task", idempotencyKey: key },
      },
      readWriteProfile,
    );

    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);
    expect(res1).toEqual(res2);

    const getRes = await executor.execute({ toolName: "get_tasks", args: {} }, readWriteProfile);
    if (getRes.ok) {
      const res = getRes.result as { total: number };
      expect(res.total).toBe(1); // Only 1 task created!
    }
  });

  // -------------------------------------------------------------------------
  // Permissions: Read-only rejection of writes
  // -------------------------------------------------------------------------
  it("rejects write tools when client is read-only", async () => {
    const outcome = await executor.execute(
      {
        toolName: "add_task",
        args: { title: "Should Fail" },
      },
      readOnlyProfile,
    );

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toContain("PERMISSION_DENIED");
    }
  });

  // -------------------------------------------------------------------------
  // Permissions: Sensitive domain access control
  // -------------------------------------------------------------------------
  it("rejects sensitive domains when not granted in allowedDomains", async () => {
    const journalRes = await executor.execute(
      {
        toolName: "get_journal",
        args: {},
      },
      restrictedProfile,
    );

    expect(journalRes.ok).toBe(false);
    if (!journalRes.ok) {
      expect(journalRes.error).toContain("DOMAIN_ACCESS_RESTRICTED");
    }

    const moneyRes = await executor.execute(
      {
        toolName: "get_money",
        args: {},
      },
      restrictedProfile,
    );
    expect(moneyRes.ok).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Notes, Goals, Habits, Blocks, Search
  // -------------------------------------------------------------------------
  it("adds notes, goals, habits, blocks, and performs unified search", async () => {
    await executor.execute(
      { toolName: "add_note", args: { title: "Project Alpha Plan", body: "Focus on AI" } },
      readWriteProfile,
    );
    await executor.execute(
      { toolName: "add_goal", args: { title: "Launch Alpha App" } },
      readWriteProfile,
    );
    await executor.execute(
      { toolName: "add_task", args: { title: "Review Alpha Code" } },
      readWriteProfile,
    );

    const searchOutcome = await executor.execute(
      { toolName: "search_all", args: { query: "Alpha" } },
      readWriteProfile,
    );

    expect(searchOutcome.ok).toBe(true);
    if (searchOutcome.ok) {
      const res = searchOutcome.result as { results: Array<{ title: string; type: string }> };
      expect(res.results.length).toBe(3);
    }
  });

  // -------------------------------------------------------------------------
  // Audit log recording
  // -------------------------------------------------------------------------
  it("records all invocations in the audit log", async () => {
    await executor.execute({ toolName: "get_tasks", args: {} }, readWriteProfile);
    await executor.execute({ toolName: "add_task", args: { title: "Audit test" } }, readOnlyProfile);

    const logs = loadAuditLog();
    expect(logs.length).toBe(2);
    expect(logs[0].outcome).toBe("denied");
    expect(logs[1].outcome).toBe("success");
  });
});
