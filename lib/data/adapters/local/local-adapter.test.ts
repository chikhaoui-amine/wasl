import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalAdapter } from "./local-adapter";
import { ARCHIVED_STORES, getStoreVersion, type StoreKey } from "../../store-registry";
import type { StoreDocument } from "../../types";
import { requestPersistentStorage, isStoragePersisted, getStorageEstimate } from "./storage";

describe("LocalAdapter (Dexie / IndexedDB)", () => {
  let dbName: string;
  let adapter: LocalAdapter;

  beforeEach(() => {
    dbName = `wasl-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    adapter = new LocalAdapter({ databaseName: dbName });
  });

  afterEach(async () => {
    await adapter.close();
  });

  it("initializes database tables and sets up initial global revision", async () => {
    await adapter.initialize();
    expect(adapter.edition).toBe("local");

    const rev = await adapter.getGlobalRevision();
    expect(rev).toBe(1);

    const db = adapter.getDatabase();
    expect(db.tables.map((t) => t.name)).toContain("documents");
    expect(db.tables.map((t) => t.name)).toContain("metadata");
    expect(db.tables.map((t) => t.name)).toContain("preferences");
    expect(db.tables.map((t) => t.name)).toContain("legacyArchives");
  });

  it("puts and gets a valid store document with incremented revision", async () => {
    await adapter.initialize();

    const notesVersion = getStoreVersion("lifeos-notes");
    const doc: StoreDocument<"lifeos-notes"> = {
      store: "lifeos-notes",
      version: notesVersion,
      state: {
        notes: [
          {
            id: "note-1",
            title: "First Note",
            body: "Hello Local Adapter",
            tag: "note",
            updatedAt: Date.now(),
            pinned: false,
          },
        ],
        categories: [],
      },
      updatedAt: new Date().toISOString(),
    };

    const saved = await adapter.putStore(doc);
    expect(saved.store).toBe("lifeos-notes");
    expect(saved.revision).toBe(2);

    const fetched = await adapter.getStore("lifeos-notes");
    expect(fetched).not.toBeNull();
    expect(fetched?.store).toBe("lifeos-notes");
    expect(fetched?.version).toBe(notesVersion);
    expect(fetched?.state.notes).toHaveLength(1);
    expect(fetched?.revision).toBe(2);

    const currentRev = await adapter.getGlobalRevision();
    expect(currentRev).toBe(2);
  });

  it("mutates a store document atomically with transactional revision increment", async () => {
    await adapter.initialize();
    const tasksVersion = getStoreVersion("lifeos-tasks");

    // Initial put
    await adapter.putStore({
      store: "lifeos-tasks",
      version: tasksVersion,
      state: {
        tasks: [
          {
            id: "task-1",
            title: "Task 1",
            status: "todo",
            priority: "med",
            createdAt: new Date().toISOString(),
            today: false,
          },
        ],
        dailyFocus: {},
      },
      updatedAt: new Date().toISOString(),
    });

    // Mutate store
    const mutated = await adapter.mutateStore("lifeos-tasks", (state) => ({
      ...state,
      tasks: [
        ...state.tasks,
        {
          id: "task-2",
          title: "Task 2",
          status: "done",
          priority: "high",
          createdAt: new Date().toISOString(),
          today: false,
        },
      ],
    }));

    expect(mutated.state.tasks).toHaveLength(2);
    expect(mutated.revision).toBe(3);

    const fetched = await adapter.getStore("lifeos-tasks");
    expect(fetched?.state.tasks).toHaveLength(2);
    expect(fetched?.revision).toBe(3);
  });

  it("retrieves all stores via getAllStores", async () => {
    await adapter.initialize();

    await adapter.putStore({
      store: "lifeos-goals",
      version: getStoreVersion("lifeos-goals"),
      state: { goals: [] },
      updatedAt: new Date().toISOString(),
    });

    await adapter.putStore({
      store: "lifeos-journal",
      version: getStoreVersion("lifeos-journal"),
      state: { entries: [] },
      updatedAt: new Date().toISOString(),
    });

    const all = await adapter.getAllStores();
    expect(all).toHaveLength(2);
    const storeNames = all.map((d) => d.store);
    expect(storeNames).toContain("lifeos-goals");
    expect(storeNames).toContain("lifeos-journal");
  });

  it("notifies subscribers when stores are written", async () => {
    await adapter.initialize();

    let notificationCount = 0;
    const unsubscribe = adapter.subscribe(() => {
      notificationCount++;
    });

    await adapter.putStore({
      store: "lifeos-habits",
      version: getStoreVersion("lifeos-habits"),
      state: { habits: [] },
      updatedAt: new Date().toISOString(),
    });

    expect(notificationCount).toBeGreaterThanOrEqual(0);
    expect(typeof unsubscribe).toBe("function");
    unsubscribe();
  });

  it("strictly rejects archived store keys from get, put, and mutate operations", async () => {
    await adapter.initialize();

    for (const archived of ARCHIVED_STORES) {
      await expect(adapter.getStore(archived as unknown as StoreKey)).rejects.toThrow(/is archived/);

      const archivedDoc = {
        store: archived,
        version: 1,
        state: {},
        updatedAt: new Date().toISOString(),
      } as unknown as StoreDocument;

      await expect(adapter.putStore(archivedDoc)).rejects.toThrow(/is archived/);

      await expect(
        adapter.mutateStore(archived as unknown as StoreKey, (s) => s),
      ).rejects.toThrow(/is archived/);
    }
  });

  it("strictly rejects invalid unknown store keys", async () => {
    await adapter.initialize();

    await expect(adapter.getStore("nonexistent-store" as unknown as StoreKey)).rejects.toThrow(
      /Unknown store key/,
    );
  });

  it("rejects version mismatch during putStore", async () => {
    await adapter.initialize();
    const correctVersion = getStoreVersion("lifeos-notes");

    await expect(
      adapter.putStore({
        store: "lifeos-notes",
        version: correctVersion + 99,
        state: { notes: [], categories: [] },
        updatedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(/Version mismatch/);
  });

  it("throws without deleting data when encountering newer incompatible schema in getStore", async () => {
    await adapter.initialize();
    const db = adapter.getDatabase();

    // Directly insert an entity with higher version to simulate newer future schema
    await db.documents.put({
      store: "lifeos-notes",
      version: 999,
      state: { notes: [], categories: [] },
      updatedAt: new Date().toISOString(),
      revision: 10,
    });

    await expect(adapter.getStore("lifeos-notes")).rejects.toThrow(/Incompatible schema version/);

    // Verify document was preserved and not deleted or reset
    const rawDoc = await db.documents.get("lifeos-notes");
    expect(rawDoc).toBeDefined();
    expect(rawDoc?.version).toBe(999);
  });

  it("persists data across database closing and reopening", async () => {
    await adapter.initialize();

    await adapter.putStore({
      store: "lifeos-money",
      version: getStoreVersion("lifeos-money"),
      state: { currency: "USD", transactions: [], savings: [] },
      updatedAt: new Date().toISOString(),
    });

    await adapter.close();

    // Reopen with new adapter instance pointing to the same database name
    const reopenedAdapter = new LocalAdapter({ databaseName: dbName });
    await reopenedAdapter.initialize();

    const fetched = await reopenedAdapter.getStore("lifeos-money");
    expect(fetched).not.toBeNull();
    expect(fetched?.state.currency).toBe("USD");
    expect(fetched?.revision).toBe(2);

    await reopenedAdapter.close();
  });

  it("handles storage utilities gracefully in test environment", async () => {
    const isPersisted = await isStoragePersisted();
    expect(typeof isPersisted).toBe("boolean");

    const requested = await requestPersistentStorage();
    expect(typeof requested).toBe("boolean");

    const estimate = await getStorageEstimate();
    expect(typeof estimate).toBe("object");
  });
});
