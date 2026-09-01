import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalAdapter } from "@/lib/data/adapters/local/local-adapter";
import { WaslLocalDatabase } from "@/lib/data/adapters/local/database";
import { WASL_TOOLS } from "@/packages/wasl-mcp-local/src/tool-definitions";
import type { McpClientProfile } from "./permissions";
import { LocalMcpExecutor } from "./local-executor";

describe("MCP V2 canonical lifecycle smoke", () => {
  let db: WaslLocalDatabase;
  let adapter: LocalAdapter;
  let executor: LocalMcpExecutor;

  const writer: McpClientProfile = {
    id: "mcp-v2-smoke-writer",
    name: "MCP V2 smoke writer",
    type: "direct",
    port: 42430,
    secret: "mcp_v2_smoke_writer_secret_123456",
    permission: "read_write",
    allowedDomains: ["notes", "trash"],
    createdAt: "2026-09-01",
    lastActiveAt: "2026-09-01",
    revoked: false,
    enabled: true,
  };

  beforeEach(async () => {
    db = new WaslLocalDatabase(`mcp-v2-smoke-${crypto.randomUUID()}`);
    adapter = new LocalAdapter({ db });
    await adapter.initialize();
    executor = new LocalMcpExecutor(adapter);
  });

  afterEach(async () => {
    await adapter.close();
  });

  it("covers create, get, update, append, search, pagination, trash, restore, retries, permissions, and conflicts", async () => {
    const largeUnicodeBody = `${"ملاحظة عربية 🌍 — بيانات كبيرة\n".repeat(10_000)}النهاية`;
    const createCall = {
      toolName: "notes_create",
      args: {
        title: "خطة MCP النهائية",
        body: largeUnicodeBody,
        idempotencyKey: "note-create-arabic-0001",
      },
    };

    const created = await executor.execute(createCall, writer);
    const retried = await executor.execute(createCall, writer);
    expect(created).toEqual(retried);
    expect(created).toMatchObject({
      ok: true,
      result: {
        id: expect.any(String),
        version: expect.any(String),
        updatedAt: expect.any(String),
        entity: { title: "خطة MCP النهائية", body: largeUnicodeBody },
      },
    });
    if (!created.ok) return;
    const createdResult = created.result as { id: string; version: string };

    const fetched = await executor.execute(
      { toolName: "notes_get", args: { id: createdResult.id } },
      writer,
    );
    expect(fetched).toMatchObject({ ok: true, result: { item: { body: largeUnicodeBody } } });

    const updated = await executor.execute(
      {
        toolName: "notes_update",
        args: {
          id: createdResult.id,
          title: "خطة MCP النهائية — محدّثة",
          expectedVersion: createdResult.version,
        },
      },
      writer,
    );
    expect(updated).toMatchObject({ ok: true, result: { entity: { title: "خطة MCP النهائية — محدّثة" } } });

    const stale = await executor.execute(
      {
        toolName: "notes_update",
        args: { id: createdResult.id, title: "كتابة قديمة", expectedVersion: createdResult.version },
      },
      writer,
    );
    expect(stale).toMatchObject({ ok: false });
    if (!stale.ok) expect(stale.error).toContain("VERSION_CONFLICT");

    const appendCall = {
      toolName: "notes_append",
      args: { id: createdResult.id, body: "إضافة واحدة ✅", idempotencyKey: "note-append-arabic-0001" },
    };
    expect(await executor.execute(appendCall, writer)).toEqual(await executor.execute(appendCall, writer));

    const searched = await executor.execute(
      { toolName: "notes_search", args: { query: "محدّثة", limit: 5 } },
      writer,
    );
    expect(searched).toMatchObject({ ok: true, result: { items: [{ id: createdResult.id }] } });

    for (let index = 0; index < 12; index += 1) {
      await executor.execute({
        toolName: "notes_create",
        args: { title: `Page note ${index}`, body: `body ${index}`, idempotencyKey: `page-note-${String(index).padStart(4, "0")}` },
      }, writer);
    }
    const firstPage = await executor.execute({ toolName: "notes_list", args: { limit: 5 } }, writer);
    expect(firstPage).toMatchObject({ ok: true, result: { items: expect.arrayContaining([]), pagination: { limit: 5, total: 13, nextCursor: "5" } } });
    const secondPage = await executor.execute({ toolName: "notes_list", args: { limit: 5, cursor: "5" } }, writer);
    expect(secondPage).toMatchObject({ ok: true, result: { pagination: { limit: 5, total: 13, nextCursor: "10" } } });
    if (firstPage.ok && secondPage.ok) {
      const firstIds = new Set((firstPage.result as { items: Array<{ id: string }> }).items.map((item) => item.id));
      expect((secondPage.result as { items: Array<{ id: string }> }).items.every((item) => !firstIds.has(item.id))).toBe(true);
    }

    const deleted = await executor.execute(
      { toolName: "notes_delete", args: { id: createdResult.id } },
      writer,
    );
    expect(deleted).toMatchObject({ ok: true, result: { movedToTrash: true, trashId: expect.any(String) } });
    if (!deleted.ok) return;
    const trashId = (deleted.result as { trashId: string }).trashId;
    expect(await executor.execute({ toolName: "notes_get", args: { id: createdResult.id } }, writer)).toMatchObject({ ok: false });
    expect(await executor.execute({ toolName: "trash_get", args: { id: trashId } }, writer)).toMatchObject({
      ok: true,
      result: { item: { id: trashId, itemType: "note" } },
    });

    expect(await executor.execute({ toolName: "trash_restore", args: { id: trashId } }, writer)).toMatchObject({ ok: true });
    expect(await executor.execute({ toolName: "notes_get", args: { id: createdResult.id } }, writer)).toMatchObject({
      ok: true,
      result: { item: { id: createdResult.id, title: "خطة MCP النهائية — محدّثة" } },
    });

    const denied = await executor.execute(
      { toolName: "notes_create", args: { title: "Denied", body: "Denied" } },
      { ...writer, permission: "read" },
    );
    expect(denied).toMatchObject({ ok: false });
    if (!denied.ok) expect(denied.error).toContain("PERMISSION_DENIED");
  });

  it("rejects invalid public input and preserves isolated legacy archives", async () => {
    const notesCreate = WASL_TOOLS.find((tool) => tool.name === "notes_create");
    expect(notesCreate?.schema.safeParse({ contentType: "undocumented-kind" }).success).toBe(false);

    const legacyPayload = {
      store: "lifeos-projects",
      state: { projects: [{ id: "legacy-project-1", name: "لا تحذفني" }] },
    };
    await db.legacyArchives.put({
      id: "legacy-projects-smoke",
      createdAt: new Date().toISOString(),
      source: "mcp-v2-smoke",
      payload: legacyPayload,
    });

    await executor.execute(
      { toolName: "notes_create", args: { title: "Active data", body: "still separate" } },
      writer,
    );
    expect((await db.legacyArchives.get("legacy-projects-smoke"))?.payload).toEqual(legacyPayload);
    expect(WASL_TOOLS.some((tool) => tool.name.includes("project"))).toBe(false);
  });
});
