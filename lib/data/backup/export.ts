import type { DataAdapter, WaslBackup, StoreDocument } from "../types";
import { isStoreKey, isArchivedStoreKey, type StoreKey } from "../store-registry";
import { calculateBackupChecksum } from "./canonical";
import type { LegacyArchiveEntity } from "../adapters/local/database";

export interface ExportOptions {
  appVersion?: string;
  preferences?: Record<string, unknown>;
  legacyArchives?: LegacyArchiveEntity[];
}

export interface ExportResult {
  backup: WaslBackup;
  json: string;
}

/**
 * Exports all active store documents from any DataAdapter (Local or Cloud) into a canonical WaslBackup format.
 *
 * Rules:
 * - 100% Lossless: Preserves doc.state exactly as stored without Zod stripping or transformation.
 * - Supports historical store shapes and does not reject older valid snapshots.
 * - Validates backup envelope, JSON serializability, store key/version, and checksum.
 * - Read-only operation on the adapter (never writes or mutates data).
 * - Never silently omits a returned active store document.
 * - Rejects any archived store from the active `stores` list.
 * - Never includes authentication sessions, API keys, passwords, MCP tokens, or OAuth codes.
 * - Calculates a deterministic SHA-256 checksum over the canonical payload.
 */
export async function exportWaslBackup(
  adapter: DataAdapter,
  options?: ExportOptions,
): Promise<ExportResult> {
  const allDocs = await adapter.getAllStores();

  const exportedStores: StoreDocument<StoreKey>[] = [];

  for (const doc of allDocs) {
    if (isArchivedStoreKey(doc.store)) {
      // Archived stores must never be included in active stores array
      continue;
    }

    if (!isStoreKey(doc.store)) {
      throw new Error(`Cannot export unrecognized store: "${doc.store}".`);
    }

    if (typeof doc.version !== "number" || isNaN(doc.version) || doc.version < 0) {
      throw new Error(
        `Export failed: Store "${doc.store}" has invalid version ${JSON.stringify(doc.version)}.`,
      );
    }

    // Verify JSON serializability of doc.state
    try {
      JSON.stringify(doc.state);
    } catch (err) {
      throw new Error(
        `Export failed: Store "${doc.store}" state is not JSON-serializable: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Preserve doc.state exactly as stored (lossless)
    exportedStores.push({
      store: doc.store,
      version: doc.version,
      state: doc.state,
      updatedAt: doc.updatedAt,
      revision: doc.revision,
    });
  }

  // Sort stores alphabetically by store key for deterministic structure
  exportedStores.sort((a, b) => a.store.localeCompare(b.store));

  const payloadWithoutChecksum: Omit<WaslBackup, "checksum"> = {
    format: "wasl-portable-backup",
    formatVersion: 1,
    appVersion: options?.appVersion ?? "0.1.0",
    exportedAt: new Date().toISOString(),
    sourceEdition: adapter.edition,
    stores: exportedStores,
    preferences: options?.preferences,
  };

  const checksum = await calculateBackupChecksum(payloadWithoutChecksum);

  const backup: WaslBackup = {
    ...payloadWithoutChecksum,
    checksum,
  };

  const json = JSON.stringify(backup, null, 2);

  return { backup, json };
}
