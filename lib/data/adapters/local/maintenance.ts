import type { DataAdapter } from "../../types";
import { WaslLocalDatabase, getLocalDatabase } from "./database";
import { LocalAdapter } from "./local-adapter";

/**
 * Resets the local IndexedDB database by clearing all tables and resetting global revision.
 *
 * Strict safety rules:
 * - Operates entirely within an atomic Dexie transaction.
 * - NEVER deletes or modifies browser localStorage keys (e.g. legacy `lifeos-*` keys).
 * - Leaves database structure intact ready for fresh operations.
 */
export async function resetLocalDatabase(
  target?: DataAdapter | WaslLocalDatabase | string,
): Promise<void> {
  let db: WaslLocalDatabase;
  if (target instanceof WaslLocalDatabase) {
    db = target;
  } else if (target instanceof LocalAdapter) {
    db = target.getDatabase();
  } else if (typeof target === "string") {
    db = getLocalDatabase(target);
  } else {
    db = getLocalDatabase("wasl-local");
  }

  if (!db.isOpen()) {
    await db.open();
  }

  await db.transaction(
    "rw",
    [db.documents, db.metadata, db.preferences, db.legacyArchives],
    async () => {
      await db.documents.clear();
      await db.preferences.clear();
      await db.legacyArchives.clear();
      await db.metadata.clear();
      await db.metadata.put({
        key: "global_revision",
        value: 1,
        updatedAt: new Date().toISOString(),
      });
    },
  );
}

/**
 * Checks whether the local IndexedDB database contains 0 active store documents.
 */
export async function isLocalDatabaseEmpty(
  target?: DataAdapter | WaslLocalDatabase | string,
): Promise<boolean> {
  let db: WaslLocalDatabase;
  if (target instanceof WaslLocalDatabase) {
    db = target;
  } else if (target instanceof LocalAdapter) {
    db = target.getDatabase();
  } else if (typeof target === "string") {
    db = getLocalDatabase(target);
  } else {
    db = getLocalDatabase("wasl-local");
  }

  if (!db.isOpen()) {
    await db.open();
  }

  const count = await db.documents.count();
  return count === 0;
}

/**
 * Checks whether any DataAdapter destination contains 0 active store documents.
 */
export async function isDatabaseEmpty(adapter: DataAdapter): Promise<boolean> {
  if (adapter.edition === "local") {
    return isLocalDatabaseEmpty(adapter);
  }
  const stores = await adapter.getAllStores();
  return stores.length === 0;
}

/**
 * Resets the active database destination (Local IndexedDB or Cloud user snapshots).
 */
export async function resetDatabase(adapter: DataAdapter): Promise<void> {
  if (adapter.edition === "local") {
    await resetLocalDatabase(adapter);
    return;
  }

  const cloud = adapter as DataAdapter & { clearAllStores?: () => Promise<void> };
  if (typeof cloud.clearAllStores === "function") {
    await cloud.clearAllStores();
    return;
  }

  const stores = await adapter.getAllStores();
  for (const storeDoc of stores) {
    await adapter.mutateStore(storeDoc.store, () => ({} as never));
  }
}
