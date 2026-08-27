import type { WaslBackup } from "../types";
import {
  isStoreKey,
  isArchivedStoreKey,
  getStoreVersion,
  type StoreKey,
} from "../store-registry";
import { validateWaslBackup } from "../schemas";
import { validateDomainStoreState } from "../validation/domain-schemas";
import { verifyBackupChecksum } from "./canonical";

export const MAX_BACKUP_SIZE_BYTES = 50 * 1024 * 1024; // 50 MiB

export interface StorePreviewDetail {
  store: string;
  version: number;
  targetVersion: number;
  status: "current" | "migration_required" | "unsupported_future" | "archived" | "unknown";
  entityCount?: number;
  error?: string;
}

export interface BackupPreviewDetails {
  valid: boolean;
  appVersion: string;
  exportedAt: string;
  sourceEdition: string;
  storeCount: number;
  stores: StorePreviewDetail[];
  legacyArchivesCount: number;
  warnings: string[];
  errors: string[];
  backup?: WaslBackup;
}

/**
 * Counts top-level entities in a store state for preview display.
 */
function extractEntityCount(store: string, state: unknown): number | undefined {
  if (!state || typeof state !== "object") return undefined;
  const s = state as Record<string, unknown>;

  if (Array.isArray(s.notes)) return s.notes.length;
  if (Array.isArray(s.items)) return s.items.length;
  if (Array.isArray(s.workouts)) return s.workouts.length;
  if (Array.isArray(s.topics)) return s.topics.length;
  if (Array.isArray(s.goals)) return s.goals.length;
  if (Array.isArray(s.tasks)) return s.tasks.length;
  if (Array.isArray(s.blocks)) return s.blocks.length;
  if (Array.isArray(s.entries)) return s.entries.length;
  if (Array.isArray(s.habits)) return s.habits.length;
  if (Array.isArray(s.transactions)) return s.transactions.length;
  if (Array.isArray(s.recurring)) return s.recurring.length;
  if (s.days && typeof s.days === "object") return Object.keys(s.days as object).length;

  return undefined;
}

/**
 * Parses and validates a .wasl-backup file or object without writing anything to any database.
 */
export async function previewWaslBackup(
  rawInput: string | unknown,
): Promise<BackupPreviewDetails> {
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. Check file size if raw string
  if (typeof rawInput === "string") {
    const byteSize = new TextEncoder().encode(rawInput).length;
    if (byteSize > MAX_BACKUP_SIZE_BYTES) {
      return {
        valid: false,
        appVersion: "unknown",
        exportedAt: "unknown",
        sourceEdition: "unknown",
        storeCount: 0,
        stores: [],
        legacyArchivesCount: 0,
        warnings: [],
        errors: [`File size (${(byteSize / (1024 * 1024)).toFixed(1)} MiB) exceeds maximum limit of 50 MiB.`],
      };
    }
  }

  // 2. Parse JSON if string
  let parsedJson: unknown;
  if (typeof rawInput === "string") {
    try {
      parsedJson = JSON.parse(rawInput);
    } catch (err) {
      return {
        valid: false,
        appVersion: "unknown",
        exportedAt: "unknown",
        sourceEdition: "unknown",
        storeCount: 0,
        stores: [],
        legacyArchivesCount: 0,
        warnings: [],
        errors: [`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
  } else {
    parsedJson = rawInput;
  }

  // 3. Validate backup envelope with Zod
  const envelopeValidation = validateWaslBackup(parsedJson);
  if (!envelopeValidation.success || !envelopeValidation.data) {
    return {
      valid: false,
      appVersion: (parsedJson as Partial<WaslBackup>)?.appVersion ?? "unknown",
      exportedAt: (parsedJson as Partial<WaslBackup>)?.exportedAt ?? "unknown",
      sourceEdition: (parsedJson as Partial<WaslBackup>)?.sourceEdition ?? "unknown",
      storeCount: Array.isArray((parsedJson as Partial<WaslBackup>)?.stores)
        ? (parsedJson as WaslBackup).stores.length
        : 0,
      stores: [],
      legacyArchivesCount: 0,
      warnings: [],
      errors: [`Backup envelope validation failed: ${envelopeValidation.error}`],
    };
  }

  const backup = envelopeValidation.data;

  // 4. Verify SHA-256 Checksum
  const isChecksumValid = await verifyBackupChecksum(backup);
  if (!isChecksumValid) {
    errors.push("Checksum mismatch: file contents have been modified or corrupted.");
  }

  // 5. Inspect each store document and run domain validation
  const storeDetails: StorePreviewDetail[] = [];

  for (const doc of backup.stores) {
    const storeKey = doc.store;

    if (isArchivedStoreKey(storeKey)) {
      warnings.push(`Store "${storeKey}" is an archived feature and will not be activated as an active store.`);
      storeDetails.push({
        store: storeKey,
        version: doc.version,
        targetVersion: doc.version,
        status: "archived",
        entityCount: extractEntityCount(storeKey, doc.state),
      });
      continue;
    }

    if (!isStoreKey(storeKey)) {
      errors.push(`Unrecognized store "${storeKey}" in backup.`);
      storeDetails.push({
        store: storeKey,
        version: doc.version,
        targetVersion: 0,
        status: "unknown",
        error: `Unrecognized store "${storeKey}".`,
      });
      continue;
    }

    const expectedVersion = getStoreVersion(storeKey as StoreKey);

    let status: StorePreviewDetail["status"] = "current";
    if (doc.version > expectedVersion) {
      status = "unsupported_future";
      errors.push(
        `Store "${storeKey}" is at future version ${doc.version}, but this app only supports up to version ${expectedVersion}.`,
      );
    } else if (doc.version < expectedVersion) {
      status = "migration_required";
      warnings.push(
        `Store "${storeKey}" is at older version ${doc.version} and will require migration to v${expectedVersion}.`,
      );
    }

    // Run strict domain validation for current version
    let domainError: string | undefined;
    if (status === "current") {
      const domainVal = validateDomainStoreState(storeKey as StoreKey, doc.state);
      if (!domainVal.success) {
        domainError = domainVal.error;
        errors.push(`Validation failed for "${storeKey}": ${domainVal.error}`);
      }
    }

    storeDetails.push({
      store: storeKey,
      version: doc.version,
      targetVersion: expectedVersion,
      status,
      entityCount: extractEntityCount(storeKey, doc.state),
      error: domainError,
    });
  }

  const valid = errors.length === 0;

  return {
    valid,
    appVersion: backup.appVersion,
    exportedAt: backup.exportedAt,
    sourceEdition: backup.sourceEdition,
    storeCount: backup.stores.length,
    stores: storeDetails,
    legacyArchivesCount: 0,
    warnings,
    errors,
    backup: valid ? backup : undefined,
  };
}
