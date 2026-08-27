import type { WaslBackup, DataAdapter, StoreStateMap } from "../types";
import { LocalAdapter } from "../adapters/local/local-adapter";
import {
  isStoreKey,
  isArchivedStoreKey,
  getStoreVersion,
  type StoreKey,
} from "../store-registry";
import { validateDomainStoreState } from "../validation/domain-schemas";
import { DOMAIN_MIGRATIONS } from "../migrations";
import { previewWaslBackup } from "./preview";
import { exportWaslBackup } from "./export";
import { canonicalizeJson } from "./canonical";
import type { DocumentEntity } from "../adapters/local/database";

export interface ImportResult {
  success: boolean;
  storesImported: number;
  globalRevision?: number;
  exportedAt: string;
  /** Non-fatal verification notes (e.g. cloud post-commit parity warning). */
  warnings?: string[];
}

export class DatabaseNotEmptyError extends Error {
  constructor(existingCount: number, edition: string = "destination") {
    super(
      `Cannot import backup: ${edition} database already contains ${existingCount} store(s). WASL strictly requires an empty database to prevent accidental data overwrites. Please export a safety backup and reset your database before importing.`,
    );
    this.name = "DatabaseNotEmptyError";
  }
}

export class LocalDatabaseNotEmptyError extends DatabaseNotEmptyError {
  constructor(existingCount: number) {
    super(existingCount, "local");
    this.name = "LocalDatabaseNotEmptyError";
  }
}

interface PreparedDoc {
  store: StoreKey;
  version: number;
  state: StoreStateMap[StoreKey];
  updatedAt: string;
}

/**
 * Prepares a backup's store documents for import:
 * - Migrates older-version documents to the current registry version in memory
 *   (old backups are upgraded instead of rejected).
 * - Validates every migrated active state against its strict domain schema.
 * Returns write-ready active docs plus archived/unknown docs (kept as archives).
 */
function prepareDocs(
  backup: WaslBackup,
): { activeDocs: PreparedDoc[]; archiveDocs: WaslBackup["stores"] } {
  const activeDocs: PreparedDoc[] = [];
  const archiveDocs: WaslBackup["stores"] = [];

  for (const doc of backup.stores) {
    if (!isStoreKey(doc.store) || isArchivedStoreKey(doc.store)) {
      archiveDocs.push(doc);
      continue;
    }

    const expectedVersion = getStoreVersion(doc.store);
    if (doc.version > expectedVersion) {
      throw new Error(
        `Store "${doc.store}" backup version ${doc.version} is newer than the supported version ${expectedVersion}. Upgrade the app, then retry the import. Data was not modified.`,
      );
    }

    let state = doc.state as StoreStateMap[StoreKey];
    if (doc.version < expectedVersion) {
      const migrationFn = DOMAIN_MIGRATIONS[doc.store];
      if (!migrationFn) {
        throw new Error(
          `Store "${doc.store}" backup version ${doc.version} requires migration but no migration is registered.`,
        );
      }
      state = migrationFn(doc.version, doc.state) as StoreStateMap[StoreKey];
    }

    const domainVal = validateDomainStoreState(doc.store, state);
    if (!domainVal.success) {
      throw new Error(`Domain validation failed for "${doc.store}": ${domainVal.error}`);
    }

    activeDocs.push({
      store: doc.store,
      version: expectedVersion,
      state,
      updatedAt: doc.updatedAt || "",
    });
  }

  return { activeDocs, archiveDocs };
}

function canonicalStoresJson(docs: { store: string; version: number; state: unknown }[]): string {
  return canonicalizeJson(
    [...docs]
      .sort((a, b) => a.store.localeCompare(b.store))
      .map((s) => ({ store: s.store, version: s.version, state: s.state })),
  );
}

/**
 * Atomically imports a WaslBackup into LocalAdapter.
 *
 * Safety Rules:
 * - Strictly refuses import if Local database is not empty (checked inside the
 *   same transaction as the writes, so concurrent imports cannot race through).
 * - No direct overwrite path is permitted.
 * - Older-version backup documents are migrated to the current version first.
 * - Validates all stores with their strict domain schema prior to write.
 * - Writes all stores, preferences, and metadata in a single atomic Dexie
 *   transaction; the post-import parity check also runs inside that
 *   transaction, so a mismatch rolls the entire import back.
 */
export async function importWaslBackupToLocal(
  backupInput: WaslBackup | string,
  adapter: LocalAdapter,
): Promise<ImportResult> {
  // 1. Preview and validate without writes
  const preview = await previewWaslBackup(backupInput);
  if (!preview.valid || !preview.backup) {
    throw new Error(
      `Backup validation failed:\n${preview.errors.join("\n")}`,
    );
  }

  const backup = preview.backup;

  await adapter.initialize();

  const db = adapter.getDatabase();
  const now = new Date().toISOString();
  const { activeDocs, archiveDocs } = prepareDocs(backup);

  // 2. Atomic Dexie transaction across documents, metadata, preferences, legacyArchives
  const importedCount = await db.transaction(
    "rw",
    [db.documents, db.metadata, db.preferences, db.legacyArchives],
    async () => {
      // Empty-database enforcement INSIDE the transaction closes the TOCTOU gap:
      // two concurrent imports cannot both pass the check and then interleave.
      const existingCount = await db.documents.count();
      if (existingCount > 0) {
        throw new LocalDatabaseNotEmptyError(existingCount);
      }

      let count = 0;

      // Import each active store document
      for (const doc of activeDocs) {
        const entity: DocumentEntity = {
          store: doc.store,
          version: doc.version,
          state: doc.state,
          updatedAt: doc.updatedAt || now,
          revision: 1,
        };
        await db.documents.put(entity);
        count++;
      }

      // Archived / legacy stores are preserved in the quarantine table
      for (const doc of archiveDocs) {
        await db.legacyArchives.put({
          id: `${doc.store}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: now,
          source: "wasl-backup",
          payload: doc,
        });
      }

      // Import preferences if present
      if (backup.preferences && typeof backup.preferences === "object") {
        for (const [key, value] of Object.entries(backup.preferences)) {
          await db.preferences.put({
            key,
            value,
            updatedAt: now,
          });
        }
      }

      // Set initial global revision to 2 (initial baseline + import)
      await db.metadata.put({
        key: "global_revision",
        value: 2,
        updatedAt: now,
      });

      // 3. In-transaction parity verification: read back what was written and
      // compare canonical content against the prepared docs. Throwing here
      // rolls back EVERYTHING (documents, archives, preferences, revision).
      const written = await db.documents.toArray();
      const originalCanonical = canonicalStoresJson(activeDocs);
      const writtenCanonical = canonicalStoresJson(
        written.map((w) => ({ store: w.store, version: w.version, state: w.state })),
      );
      if (originalCanonical !== writtenCanonical) {
        throw new Error(
          "Integrity check failed: re-read database content does not match the imported backup.",
        );
      }

      return count;
    },
  );

  const finalRev = await adapter.getGlobalRevision();

  return {
    success: true,
    storesImported: importedCount,
    globalRevision: finalRev,
    exportedAt: backup.exportedAt,
  };
}

/**
 * Universal full restore function for any DataAdapter (Local or Cloud).
 *
 * Cloud path: performs ONE bulk upsert (a single PostgREST statement is applied
 * atomically server-side), so a network failure can no longer strand a
 * half-restored database that would block retries via the empty-destination rule.
 *
 * Strictly requires an empty destination database and validates domain schemas before writing.
 */
export async function importWaslBackup(
  adapter: DataAdapter,
  backupInput: WaslBackup | string,
): Promise<ImportResult> {
  if (adapter.edition === "local" && adapter instanceof LocalAdapter) {
    return importWaslBackupToLocal(backupInput, adapter);
  }

  // Preview and validate
  const preview = await previewWaslBackup(backupInput);
  if (!preview.valid || !preview.backup) {
    throw new Error(`Backup validation failed:\n${preview.errors.join("\n")}`);
  }

  const backup = preview.backup;

  // Enforce empty database check
  const existing = await adapter.getAllStores();
  if (existing.length > 0) {
    throw new DatabaseNotEmptyError(existing.length, adapter.edition);
  }

  const now = new Date().toISOString();
  const { activeDocs } = prepareDocs(backup);

  const restore = adapter as DataAdapter & {
    restoreAllStores?: (
      docs: { store: StoreKey; version: number; state: StoreStateMap[StoreKey]; updatedAt: string }[],
    ) => Promise<unknown>;
  };

  if (typeof restore.restoreAllStores === "function") {
    // Single-statement bulk upsert — atomic on the server.
    await restore.restoreAllStores(
      activeDocs.map((d) => ({ ...d, updatedAt: d.updatedAt || now })),
    );
  } else {
    // Fallback for adapters without bulk restore support.
    for (const doc of activeDocs) {
      await adapter.putStore({
        store: doc.store,
        version: doc.version,
        state: doc.state,
        updatedAt: doc.updatedAt || now,
      });
    }
  }

  // Post-commit parity verification. By this point the data IS committed, so a
  // verification failure must not claim the import failed — it surfaces as a warning.
  const warnings: string[] = [];
  try {
    const reExport = await exportWaslBackup(adapter);
    const originalCanonical = canonicalStoresJson(activeDocs);
    const exportedCanonical = canonicalStoresJson(reExport.backup.stores);
    if (originalCanonical !== exportedCanonical) {
      warnings.push(
        "Post-import verification reported differences between the backup and the restored cloud data. Please export a fresh backup to confirm contents.",
      );
    }
  } catch (err) {
    warnings.push(
      `Post-import verification could not complete: ${err instanceof Error ? err.message : String(err)}. The import itself was committed; please export a fresh backup to confirm contents.`,
    );
  }

  return {
    success: true,
    storesImported: activeDocs.length,
    exportedAt: backup.exportedAt,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
