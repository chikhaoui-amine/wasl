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
        toolName: "tasks_create",
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
    const getOutcome = await executor.execute({ toolName: "tasks_list", args: {} }, readWriteProfile);
    expect(getOutcome.ok).toBe(true);
    if (getOutcome.ok) {
      const res = getOutcome.result as { items: Array<{ id: string; title: string }>; pagination: { total: number } };
      expect(res.pagination.total).toBe(1);
      expect(res.items[0].title).toBe("Complete Local MCP");
    }

    // 3. Update task
    const updateOutcome = await executor.execute(
      {
        toolName: "tasks_update",
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
      { toolName: "tasks_delete", args: { id: task.id } },
      readWriteProfile,
    );
    expect(deleteOutcome.ok).toBe(true);

    // Verify removed from tasks
    const getAfterDelete = await executor.execute({ toolName: "tasks_list", args: {} }, readWriteProfile);
    if (getAfterDelete.ok) {
      const res = getAfterDelete.result as { pagination: { total: number } };
      expect(res.pagination.total).toBe(0);
    }

    // Verify exists in trash
    const getTrash = await executor.execute({ toolName: "trash_list", args: {} }, readWriteProfile);
    expect(getTrash.ok).toBe(true);
    if (getTrash.ok) {
      const res = getTrash.result as { items: Array<{ title: string; itemType: string }> };
      expect(res.items.length).toBe(1);
      expect(res.items[0].title).toBe("Complete Local MCP");
      expect(res.items[0].itemType).toBe("task");
    }
  });

  it("supports paginated note list, search, get, and atomic append", async () => {
    const created = await executor.execute(
      { toolName: "notes_create", args: { title: "Retrieval architecture", body: "Alpha" } },
      readWriteProfile,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = (created.result as { note: { id: string } }).note.id;

    const listed = await executor.execute(
      { toolName: "notes_list", args: { limit: 1 } },
      readWriteProfile,
    );
    const searched = await executor.execute(
      { toolName: "notes_search", args: { query: "alpha" } },
      readWriteProfile,
    );
    const fetched = await executor.execute(
      { toolName: "notes_get", args: { id } },
      readWriteProfile,
    );
    const appended = await executor.execute(
      { toolName: "notes_append", args: { id, body: "Beta" } },
      readWriteProfile,
    );

    expect(listed).toMatchObject({ ok: true, result: { items: [{ id }], pagination: { total: 1 } } });
    expect(searched).toMatchObject({ ok: true, result: { items: [{ id }] } });
    expect(fetched).toMatchObject({ ok: true, result: { item: { id, body: "Alpha" } } });
    expect(appended).toMatchObject({ ok: true, result: { note: { id, body: "Alpha\n\nBeta" } } });
  });

  it("supports creating notes with section and managing category sections", async () => {
    const addCat = await executor.execute(
      { toolName: "note_categories_create", args: { name: "Ideas", sections: ["Approved", "Rejected"] } },
      readWriteProfile,
    );
    expect(addCat.ok).toBe(true);
    if (!addCat.ok) return;
    const catResult = addCat.result as { category: { id: string } };
    const catId = catResult.category.id;

    const listCats = await executor.execute(
      { toolName: "note_categories_list", args: {} },
      readWriteProfile,
    );
    expect(listCats.ok).toBe(true);
    if (!listCats.ok) return;
    const listResult = listCats.result as { items: Array<{ id: string; sections?: string[] }> };
    const foundCat = listResult.items.find((c) => c.id === catId);
    expect(foundCat?.sections).toEqual(["Approved", "Rejected"]);

    const created = await executor.execute(
      { toolName: "notes_create", args: { title: "Great idea", tag: "Ideas", section: "Approved" } },
      readWriteProfile,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const createResult = created.result as { note: { id: string; section?: string } };
    const noteId = createResult.note.id;
    expect(createResult.note.section).toBe("Approved");

    const updated = await executor.execute(
      { toolName: "notes_update", args: { id: noteId, section: "Rejected" } },
      readWriteProfile,
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    const updateResult = updated.result as { note: { id: string; section?: string } };
    expect(updateResult.note.section).toBe("Rejected");
  });

  // -------------------------------------------------------------------------
  // Idempotency
  // -------------------------------------------------------------------------
  it("prevents duplicate creation when idempotencyKey is reused", async () => {
    const key = "unique_write_op_123";
    const res1 = await executor.execute(
      {
        toolName: "tasks_create",
        args: { title: "Idempotent Task", idempotencyKey: key },
      },
      readWriteProfile,
    );
    const res2 = await executor.execute(
      {
        toolName: "tasks_create",
        args: { title: "Idempotent Task", idempotencyKey: key },
      },
      readWriteProfile,
    );

    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);
    expect(res1).toEqual(res2);

    const getRes = await executor.execute({ toolName: "tasks_list", args: {} }, readWriteProfile);
    if (getRes.ok) {
      const res = getRes.result as { pagination: { total: number } };
      expect(res.pagination.total).toBe(1); // Only 1 task created!
    }
  });

  it("rejects idempotency-key reuse with different arguments", async () => {
    const idempotencyKey = "same-key-different-request";
    await executor.execute({ toolName: "tasks_create", args: { title: "First", idempotencyKey } }, readWriteProfile);
    const replay = await executor.execute({ toolName: "tasks_create", args: { title: "Second", idempotencyKey } }, readWriteProfile);
    expect(replay).toMatchObject({ ok: false });
    if (!replay.ok) expect(replay.error).toContain("VALIDATION_ERROR");
  });

  it("returns mutation receipts and rejects stale expectedVersion tokens", async () => {
    const created = await executor.execute({ toolName: "tasks_create", args: { title: "Versioned" } }, readWriteProfile);
    expect(created).toMatchObject({ ok: true, result: { id: expect.any(String), version: expect.any(String), updatedAt: expect.any(String), entity: { title: "Versioned" } } });
    if (!created.ok) return;
    const task = (created.result as { task: { id: string }; version: string }).task;
    const staleVersion = (created.result as { version: string }).version;

    await executor.execute({ toolName: "tasks_create", args: { title: "Concurrent write" } }, readWriteProfile);
    const stale = await executor.execute(
      { toolName: "tasks_update", args: { id: task.id, title: "Stale overwrite", expectedVersion: staleVersion } },
      readWriteProfile,
    );
    expect(stale).toMatchObject({ ok: false });
    if (!stale.ok) expect(stale.error).toContain("VERSION_CONFLICT");
  });

  it("rejects duplicate-title mutation references as ambiguous instead of mutating siblings", async () => {
    await executor.execute({ toolName: "tasks_create", args: { title: "Duplicate" } }, readWriteProfile);
    await executor.execute({ toolName: "tasks_create", args: { title: "Duplicate" } }, readWriteProfile);
    const outcome = await executor.execute({ toolName: "tasks_delete", args: { id: "Duplicate" } }, readWriteProfile);
    expect(outcome).toMatchObject({ ok: false });
    if (!outcome.ok) expect(outcome.error).toContain("AMBIGUOUS_MATCH");
    const tasks = await executor.execute({ toolName: "tasks_list", args: {} }, readWriteProfile);
    expect(tasks).toMatchObject({ ok: true, result: { pagination: { total: 2 } } });
  });

  // -------------------------------------------------------------------------
  // Permissions: Read-only rejection of writes
  // -------------------------------------------------------------------------
  it("rejects write tools when client is read-only", async () => {
    const outcome = await executor.execute(
      {
        toolName: "tasks_create",
        args: { title: "Should Fail" },
      },
      readOnlyProfile,
    );

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toContain("PERMISSION_DENIED");
    }
  });

  it("exposes safe capabilities and rejects disabled clients", async () => {
    const capabilities = await executor.execute({ toolName: "system_capabilities_get", args: {} }, readOnlyProfile);
    expect(capabilities).toMatchObject({
      ok: true,
      result: {
        permission: "read",
        canWrite: false,
        deprecatedTools: { add_task: "tasks_create", add_note: "notes_create" },
        mutationSafety: { immutableIdsRequired: true },
      },
    });

    const disabled = await executor.execute(
      { toolName: "tasks_list", args: {} },
      { ...readWriteProfile, enabled: false },
    );
    expect(disabled).toMatchObject({ ok: false });
    if (!disabled.ok) expect(disabled.error).toContain("PERMISSION_DENIED");
  });

  it("requires target-bound confirmation for permanent Local deletes", async () => {
    const account = await executor.execute(
      { toolName: "money_accounts_create", args: { name: "Cash", type: "cash" } },
      readWriteProfile,
    );
    expect(account.ok).toBe(true);
    if (!account.ok) return;
    const id = (account.result as { account: { id: string } }).account.id;

    const denied = await executor.execute({ toolName: "money_accounts_delete", args: { id } }, readWriteProfile);
    expect(denied).toMatchObject({ ok: false });
    const confirmed = await executor.execute(
      { toolName: "money_accounts_delete", args: { id, confirmation: `DELETE:${id}` } },
      readWriteProfile,
    );
    expect(confirmed).toMatchObject({ ok: true, result: { id } });
  });

  // -------------------------------------------------------------------------
  // Permissions: Sensitive domain access control
  // -------------------------------------------------------------------------
  it("rejects sensitive domains when not granted in allowedDomains", async () => {
    const journalRes = await executor.execute(
      {
        toolName: "journal_list",
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
        toolName: "money_overview_get",
        args: {},
      },
      restrictedProfile,
    );
    expect(moneyRes.ok).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Notes, Goals, Habits, Blocks, Search
  // -------------------------------------------------------------------------
  it("adds notes, goals, and tasks and searches each domain explicitly", async () => {
    await executor.execute(
      { toolName: "notes_create", args: { title: "Project Alpha Plan", body: "Focus on AI" } },
      readWriteProfile,
    );
    await executor.execute(
      { toolName: "goals_create", args: { title: "Launch Alpha App" } },
      readWriteProfile,
    );
    await executor.execute(
      { toolName: "tasks_create", args: { title: "Review Alpha Code" } },
      readWriteProfile,
    );

    const results = await Promise.all([
      executor.execute({ toolName: "notes_search", args: { query: "Alpha" } }, readWriteProfile),
      executor.execute({ toolName: "goals_search", args: { query: "Alpha" } }, readWriteProfile),
      executor.execute({ toolName: "tasks_search", args: { query: "Alpha" } }, readWriteProfile),
    ]);
    expect(results).toEqual([
      expect.objectContaining({ ok: true, result: expect.objectContaining({ items: [expect.objectContaining({ title: "Project Alpha Plan" })] }) }),
      expect.objectContaining({ ok: true, result: expect.objectContaining({ items: [expect.objectContaining({ title: "Launch Alpha App" })] }) }),
      expect.objectContaining({ ok: true, result: expect.objectContaining({ items: [expect.objectContaining({ title: "Review Alpha Code" })] }) }),
    ]);
  });

  // -------------------------------------------------------------------------
  // Audit log recording
  // -------------------------------------------------------------------------
  it("records all invocations in the audit log", async () => {
    await executor.execute({ toolName: "tasks_list", args: {} }, readWriteProfile);
    await executor.execute({ toolName: "tasks_create", args: { title: "Audit test" } }, readOnlyProfile);

    const logs = loadAuditLog();
    expect(logs.length).toBe(2);
    expect(logs[0].outcome).toBe("denied");
    expect(logs[1].outcome).toBe("success");
  });
});
