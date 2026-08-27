import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { LocalAdapter } from "../adapters/local/local-adapter";
import { resetLocalDatabase, isDatabaseEmpty } from "../adapters/local/maintenance";
import {
  exportWaslBackup,
  previewWaslBackup,
  importWaslBackup,
  exportWaslTransfer,
  previewWaslTransfer,
  importWaslTransfer,
  DatabaseNotEmptyError,
} from "./index";
import type { StoreDocument, StoreKey, DataAdapter } from "../types";
import { getStoreVersion } from "../store-registry";

/**
 * Mock Cloud Adapter for testing cross-edition interoperability without external network.
 */
class MockCloudAdapter implements DataAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly edition = "cloud" as any;
  private stores = new Map<StoreKey, StoreDocument<StoreKey>>();

  async initialize(): Promise<void> {}

  async getStore<K extends StoreKey>(store: K): Promise<StoreDocument<K> | null> {
    const doc = this.stores.get(store);
    return doc ? (JSON.parse(JSON.stringify(doc)) as StoreDocument<K>) : null;
  }

  async putStore<K extends StoreKey>(document: StoreDocument<K>): Promise<StoreDocument<K>> {
    this.stores.set(document.store, JSON.parse(JSON.stringify(document)));
    return document;
  }

  async mutateStore<K extends StoreKey>(
    store: K,
    mutation: (state: import("../types").StoreStateMap[K]) => import("../types").StoreStateMap[K],
  ): Promise<StoreDocument<K>> {
    const current = await this.getStore(store);
    const nextState = mutation((current ? current.state : {}) as import("../types").StoreStateMap[K]);
    const doc: StoreDocument<K> = {
      store,
      version: getStoreVersion(store),
      state: nextState,
      updatedAt: new Date().toISOString(),
    };
    return this.putStore(doc);
  }

  async getAllStores(): Promise<StoreDocument<StoreKey>[]> {
    return Array.from(this.stores.values()).map((doc) => JSON.parse(JSON.stringify(doc)));
  }

  async clearAllStores(): Promise<void> {
    this.stores.clear();
  }

  subscribe(): () => void {
    return () => {};
  }
}

describe("WASL Data Portability & Cross-Edition Interoperability Matrix", () => {
  let localAdapter: LocalAdapter;
  let cloudAdapter: MockCloudAdapter;

  beforeEach(async () => {
    await resetLocalDatabase("wasl-interop-local");
    localAdapter = new LocalAdapter("wasl-interop-local");
    await localAdapter.initialize();

    cloudAdapter = new MockCloudAdapter();
    await cloudAdapter.initialize();
  });

  it("Full Snapshot Interoperability: Cloud → Local", async () => {
    // 1. Seed Cloud Adapter with notes and goals
    await cloudAdapter.putStore({
      store: "lifeos-notes",
      version: getStoreVersion("lifeos-notes"),
      state: {
        notes: [
          { id: "note-c1", title: "Cloud Note 1", body: "Cloud Body", tag: "General", pinned: false, updatedAt: 1704067200000 },
        ],
        categories: [],
      },
      updatedAt: new Date().toISOString(),
    });

    await cloudAdapter.putStore({
      store: "lifeos-goals",
      version: getStoreVersion("lifeos-goals"),
      state: {
        goals: [
          { id: "goal-c1", title: "Cloud Goal 1", plan: "Strategy", milestones: [], manualProgress: 20, completed: false, category: "Career", status: "active" },
        ],
      },
      updatedAt: new Date().toISOString(),
    });

    // 2. Export .wasl-backup from Cloud
    const { backup, json } = await exportWaslBackup(cloudAdapter);
    expect(backup.sourceEdition).toBe("cloud");
    expect(backup.stores).toHaveLength(2);

    // 3. Attempt import into non-empty Local destination -> must fail
    await localAdapter.putStore({
      store: "lifeos-habits",
      version: getStoreVersion("lifeos-habits"),
      state: {
        habits: [
          { id: "habit-1", name: "Run", icon: "activity", targetPerWeek: 3, color: "blue", log: {}, createdAt: "2026-01-01" },
        ],
      },
      updatedAt: new Date().toISOString(),
    });

    await expect(importWaslBackup(localAdapter, json)).rejects.toThrow(DatabaseNotEmptyError);

    // 4. Reset Local destination and restore
    await resetLocalDatabase(localAdapter);
    expect(await isDatabaseEmpty(localAdapter)).toBe(true);

    const importResult = await importWaslBackup(localAdapter, json);
    expect(importResult.success).toBe(true);
    expect(importResult.storesImported).toBe(2);

    // Verify Local contents
    const restoredNotes = await localAdapter.getStore("lifeos-notes");
    expect(restoredNotes?.state.notes).toHaveLength(1);
    expect(restoredNotes?.state.notes[0].title).toBe("Cloud Note 1");
  });

  it("Full Snapshot Interoperability: Local → Cloud", async () => {
    // 1. Seed Local Adapter
    await localAdapter.putStore({
      store: "lifeos-tasks",
      version: getStoreVersion("lifeos-tasks"),
      state: {
        tasks: [
          { id: "task-l1", title: "Local Task 1", status: "todo", priority: "high", today: true, createdAt: "2026-01-01" },
        ],
        dailyFocus: {},
      },
      updatedAt: new Date().toISOString(),
    });

    // 2. Export from Local
    const localStores = await localAdapter.getAllStores();
    const { json } = await exportWaslBackup(localAdapter);

    // 3. Restore to Cloud Adapter (empty destination)
    expect(await isDatabaseEmpty(cloudAdapter)).toBe(true);
    const importResult = await importWaslBackup(cloudAdapter, json);
    expect(importResult.success).toBe(true);
    expect(importResult.storesImported).toBe(localStores.length);

    // Verify Cloud contents
    const restoredTasks = await cloudAdapter.getStore("lifeos-tasks");
    expect(restoredTasks?.state.tasks[0].title).toBe("Local Task 1");
  });

  it("Accepts both .wasl-backup and legacy .json content transparently", async () => {
    const rawJsonBackup = JSON.stringify({
      format: "wasl-portable-backup",
      formatVersion: 1,
      appVersion: "0.1.0",
      exportedAt: new Date().toISOString(),
      sourceEdition: "local",
      stores: [
        {
          store: "lifeos-journal",
          version: getStoreVersion("lifeos-journal"),
          state: {
            entries: [
              { id: "entry-1", date: "2026-01-01", mood: "great", body: "Great day", createdAt: 1704067200000 },
            ],
          },
          updatedAt: new Date().toISOString(),
        },
      ],
      checksum: "",
    });

    const { calculateBackupChecksum } = await import("./canonical");
    const { checksum: _discard, ...payloadToHash } = JSON.parse(rawJsonBackup);
    const checksum = await calculateBackupChecksum(payloadToHash);
    const parsed = { ...payloadToHash, checksum };

    const validJsonString = JSON.stringify(parsed);

    // Preview succeeds on raw string
    const preview = await previewWaslBackup(validJsonString);
    expect(preview.valid).toBe(true);
    expect(preview.storeCount).toBe(1);

    // Restore succeeds into empty local database
    await resetLocalDatabase(localAdapter);
    const res = await importWaslBackup(localAdapter, validJsonString);
    expect(res.success).toBe(true);
    expect(res.storesImported).toBe(1);
  });

  it("Selective Transfer Interoperability: Cloud → Local with Merge Strategies", async () => {
    // 1. Populate Local destination with existing notes
    await localAdapter.putStore({
      store: "lifeos-notes",
      version: getStoreVersion("lifeos-notes"),
      state: {
        notes: [
          { id: "note-1", title: "Existing Local Note", body: "Original", tag: "notes", pinned: false, updatedAt: 1767225600000 },
        ],
        categories: [],
      },
      updatedAt: new Date().toISOString(),
    });

    // 2. Populate Cloud source with overlapping Note 1 and new Note 2
    await cloudAdapter.putStore({
      store: "lifeos-notes",
      version: getStoreVersion("lifeos-notes"),
      state: {
        notes: [
          { id: "note-1", title: "Cloud Modified Note", body: "New Cloud Body", tag: "notes", pinned: false, updatedAt: 1767225600000 },
          { id: "note-2", title: "Brand New Note", body: "Brand New Body", tag: "notes", pinned: false, updatedAt: 1767225600000 },
        ],
        categories: [],
      },
      updatedAt: new Date().toISOString(),
    });

    // 3. Export .wasl-transfer from Cloud
    const { transfer } = await exportWaslTransfer(cloudAdapter, {
      domains: ["lifeos-notes"],
    });

    // 4. Preview transfer against Local destination
    const preview = await previewWaslTransfer(transfer, localAdapter);
    expect(preview.valid).toBe(true);
    expect(preview.stores[0].duplicateCount).toBe(1);
    expect(preview.stores[0].newCount).toBe(1);

    // 5. Import with "skip" strategy (default) -> does not overwrite note-1
    const res = await importWaslTransfer(localAdapter, transfer, { strategy: "skip" });
    expect(res.entitiesImported).toBe(1);
    expect(res.entitiesSkipped).toBe(1);

    const localNotes = await localAdapter.getStore("lifeos-notes");
    expect(localNotes?.state.notes).toHaveLength(2);
    expect(localNotes?.state.notes.find((n) => n.id === "note-1")?.title).toBe("Existing Local Note");
    expect(localNotes?.state.notes.find((n) => n.id === "note-2")?.title).toBe("Brand New Note");
  });
});

