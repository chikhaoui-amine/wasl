import { liveQuery, type Subscription } from "dexie";
import type { DataAdapter, StoreDocument, StoreStateMap } from "../../types";
import {
  isStoreKey,
  isArchivedStoreKey,
  getStoreVersion,
  type StoreKey,
} from "../../store-registry";
import { validateStoreDocument } from "../../schemas";
import { WaslLocalDatabase, getLocalDatabase, type DocumentEntity } from "./database";
import { requestPersistentStorage } from "./storage";

const GLOBAL_REVISION_KEY = "global_revision";

export interface LocalAdapterOptions {
  databaseName?: string;
  db?: WaslLocalDatabase;
  /**
   * Optional per-store migration functions applied in memory when a persisted
   * document's version is older than the current registry version.
   */
  migrations?: Partial<Record<StoreKey, (oldVersion: number, oldState: unknown) => unknown>>;
}

/**
 * Validates that a key is an active registered StoreKey and not an archived store.
 */
function assertActiveStoreKey(key: string): asserts key is StoreKey {
  if (isArchivedStoreKey(key)) {
    throw new Error(
      `Store "${key}" is archived and cannot be used as an active store.`,
    );
  }
  if (!isStoreKey(key)) {
    throw new Error(`Unknown store key: "${key}".`);
  }
}

/**
 * DataAdapter implementation for WASL Local Edition using Dexie and IndexedDB.
 *
 * Constraints & Guarantees:
 * - Operates entirely locally with zero Supabase or remote network dependencies.
 * - All writes execute within atomic Dexie transactions.
 * - Maintains a monotonic global revision record in the metadata table.
 * - Cross-tab and local invalidation via Dexie liveQuery.
 * - Never silently resets incompatible or newer data on version mismatch.
 */
export class LocalAdapter implements DataAdapter {
  readonly edition = "local" as const;
  private db: WaslLocalDatabase;
  private migrations: LocalAdapterOptions["migrations"];
  private isInitialized = false;
  private liveQuerySubscription: Subscription | null = null;
  private listeners = new Set<(storeKey?: StoreKey) => void>();

  constructor(options?: LocalAdapterOptions | string) {
    if (typeof options === "object" && options?.db) {
      this.db = options.db;
      this.migrations = options.migrations;
    } else if (typeof options === "object") {
      const dbName = options.databaseName ?? "wasl-local";
      this.db = getLocalDatabase(dbName);
      this.migrations = options.migrations;
    } else {
      const dbName = typeof options === "string" ? options : "wasl-local";
      this.db = getLocalDatabase(dbName);
    }
  }

  /**
   * Initializes the database connection, table structures, and global revision metadata.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.db.isOpen()) {
      return;
    }

    if (!this.db.isOpen()) {
      await this.db.open();
    }

    // Ensure global revision metadata record exists
    await this.db.transaction("rw", this.db.metadata, async () => {
      const existing = await this.db.metadata.get(GLOBAL_REVISION_KEY);
      if (!existing) {
        await this.db.metadata.put({
          key: GLOBAL_REVISION_KEY,
          value: 1,
          updatedAt: new Date().toISOString(),
        });
      }
    });

    // Request persistent storage if supported (best effort)
    await requestPersistentStorage();

    // Setup liveQuery subscription for real-time and cross-tab change notifications
    this.setupLiveQuery();

    this.isInitialized = true;
  }

  /**
   * Retrieves the current document for a specific domain store.
   */
  async getStore<K extends StoreKey>(store: K): Promise<StoreDocument<K> | null> {
    assertActiveStoreKey(store);
    await this.ensureInitialized();

    const entity = await this.db.documents.get(store);
    if (!entity) {
      return null;
    }

    const expectedVersion = getStoreVersion(store);
    if (entity.version > expectedVersion) {
      throw new Error(
        `Incompatible schema version for store "${store}": document is version ${entity.version}, but current code supports version ${expectedVersion}. Data was preserved and not modified.`,
      );
    }

    let state = entity.state as StoreStateMap[K];
    if (entity.version < expectedVersion) {
      // Migrate older snapshots in memory (non-destructive: the persisted
      // document is only rewritten to the new version on the next write).
      const migrationFn = this.migrations?.[store];
      state = migrationFn
        ? (migrationFn(entity.version, entity.state) as StoreStateMap[K])
        : state;
    }

    return {
      store: entity.store as K,
      version: expectedVersion,
      state,
      updatedAt: entity.updatedAt,
      revision: entity.revision,
    };
  }

  /**
   * Stores a domain document atomically with a monotonic revision increment.
   */
  async putStore<K extends StoreKey>(document: StoreDocument<K>): Promise<StoreDocument<K>> {
    assertActiveStoreKey(document.store);
    await this.ensureInitialized();

    const validation = validateStoreDocument(document);
    if (!validation.success) {
      throw new Error(
        `Invalid StoreDocument envelope for "${document.store}": ${validation.error}`,
      );
    }

    const expectedVersion = getStoreVersion(document.store);
    if (document.version !== expectedVersion) {
      throw new Error(
        `Version mismatch for store "${document.store}": provided document version ${document.version} does not match expected version ${expectedVersion}.`,
      );
    }

    const now = document.updatedAt || new Date().toISOString();

    const storedDoc = await this.db.transaction(
      "rw",
      [this.db.documents, this.db.metadata],
      async () => {
        // Increment global revision
        const revRecord = await this.db.metadata.get(GLOBAL_REVISION_KEY);
        const currentRev = typeof revRecord?.value === "number" ? revRecord.value : 0;
        const nextRev = currentRev + 1;

        await this.db.metadata.put({
          key: GLOBAL_REVISION_KEY,
          value: nextRev,
          updatedAt: now,
        });

        const entity: DocumentEntity = {
          store: document.store,
          version: document.version,
          state: document.state as unknown as StoreStateMap[StoreKey],
          updatedAt: now,
          revision: nextRev,
        };

        await this.db.documents.put(entity);

        return {
          store: document.store,
          version: document.version,
          state: document.state,
          updatedAt: now,
          revision: nextRev,
        };
      },
    );

    return storedDoc;
  }

  /**
   * Performs an atomic transactional mutation on a store document.
   */
  async mutateStore<K extends StoreKey>(
    store: K,
    mutation: (state: StoreStateMap[K]) => StoreStateMap[K],
    options?: { expectedVersion?: string },
  ): Promise<StoreDocument<K>> {
    assertActiveStoreKey(store);
    await this.ensureInitialized();

    const expectedVersion = getStoreVersion(store);
    const updatedDoc = await this.db.transaction(
      "rw",
      [this.db.documents, this.db.metadata],
      async () => {
        const existing = await this.db.documents.get(store);
        const previousTime = existing ? Date.parse(existing.updatedAt) : Number.NaN;
        const now = new Date(Math.max(Date.now(), Number.isFinite(previousTime) ? previousTime + 1 : 0)).toISOString();

        if (options?.expectedVersion !== undefined && existing?.updatedAt !== options.expectedVersion) {
          throw new Error(`VERSION_CONFLICT: Store "${store}" changed after it was read.`);
        }

        if (existing && existing.version > expectedVersion) {
          throw new Error(
            `Cannot mutate store "${store}": stored document is at version ${existing.version}, which is newer than supported version ${expectedVersion}.`,
          );
        }

        let currentState = existing?.state ?? {};
        if (existing && existing.version < expectedVersion) {
          const migrationFn = this.migrations?.[store];
          if (migrationFn) {
            currentState = migrationFn(existing.version, existing.state) as StoreStateMap[K];
          }
        }
        const nextState = mutation(currentState as StoreStateMap[K]);

        const revRecord = await this.db.metadata.get(GLOBAL_REVISION_KEY);
        const currentRev = typeof revRecord?.value === "number" ? revRecord.value : 0;
        const nextRev = currentRev + 1;

        await this.db.metadata.put({
          key: GLOBAL_REVISION_KEY,
          value: nextRev,
          updatedAt: now,
        });

        const entity: DocumentEntity = {
          store,
          version: expectedVersion,
          state: nextState as unknown as StoreStateMap[StoreKey],
          updatedAt: now,
          revision: nextRev,
        };

        await this.db.documents.put(entity);

        return {
          store,
          version: expectedVersion,
          state: nextState,
          updatedAt: now,
          revision: nextRev,
        };
      },
    );

    return updatedDoc;
  }

  /**
   * Retrieves all persisted store documents.
   */
  async getAllStores(): Promise<StoreDocument<StoreKey>[]> {
    await this.ensureInitialized();

    const entities = await this.db.documents.toArray();
    return entities
      .filter((e) => isStoreKey(e.store))
      .map((e) => {
        const store = e.store as StoreKey;
        const expectedVersion = getStoreVersion(store);
        let state = e.state as StoreStateMap[StoreKey];
        let version = e.version;
        if (e.version < expectedVersion) {
          const migrationFn = this.migrations?.[store];
          if (migrationFn) {
            state = migrationFn(e.version, e.state) as StoreStateMap[StoreKey];
            version = expectedVersion;
          }
        }
        return {
          store,
          version,
          state,
          updatedAt: e.updatedAt,
          revision: e.revision,
        };
      });
  }

  /**
   * Subscribes to storage changes (triggers on both local writes and cross-tab IndexedDB events).
   */
  subscribe(listener: (storeKey?: StoreKey) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Retrieves the current global revision.
   */
  async getGlobalRevision(): Promise<number> {
    await this.ensureInitialized();
    const record = await this.db.metadata.get(GLOBAL_REVISION_KEY);
    return typeof record?.value === "number" ? record.value : 1;
  }

  /**
   * Closes the Dexie database connection and cleans up subscriptions.
   */
  async close(): Promise<void> {
    if (this.liveQuerySubscription) {
      this.liveQuerySubscription.unsubscribe();
      this.liveQuerySubscription = null;
    }
    this.listeners.clear();
    this.isInitialized = false;
    await this.db.close();
  }

  /**
   * Returns underlying Dexie database instance.
   */
  getDatabase(): WaslLocalDatabase {
    return this.db;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized || !this.db.isOpen()) {
      await this.initialize();
    }
  }

  private setupLiveQuery(): void {
    if (this.liveQuerySubscription) {
      return;
    }

    try {
      // Track the last-seen updatedAt per store so a change to ONE document only
      // notifies subscribers for THAT store, instead of firing every listener
      // once per document on every table change (the "invalidation storm").
      let lastSeen = new Map<string, string>();
      let hasBaseline = false;

      const observable = liveQuery(() => this.db.documents.toArray());
      this.liveQuerySubscription = observable.subscribe({
        next: (docs) => {
          const next = new Map<string, string>();
          for (const doc of docs) {
            if (isStoreKey(doc.store)) {
              next.set(doc.store, doc.updatedAt);
            }
          }

          if (!hasBaseline) {
            // First emission establishes the baseline without notifying.
            lastSeen = next;
            hasBaseline = true;
            return;
          }

          const changed: StoreKey[] = [];
          for (const [storeKey, updatedAt] of next) {
            if (lastSeen.get(storeKey) !== updatedAt && isStoreKey(storeKey)) {
              changed.push(storeKey);
            }
          }
          lastSeen = next;

          if (changed.length === 0) {
            return;
          }
          for (const listener of this.listeners) {
            for (const storeKey of changed) {
              listener(storeKey);
            }
          }
        },
        error: () => {
          // liveQuery error handled silently without crash
        },
      });
    } catch {
      // In non-browser test environments without full Dexie liveQuery observers, fallback gracefully
    }
  }
}
