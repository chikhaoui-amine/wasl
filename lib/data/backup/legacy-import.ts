import type { WaslBackup, StoreDocument } from "../types";
import {
  isStoreKey,
  isArchivedStoreKey,
  getStoreVersion,
  type StoreKey,
  type ArchivedStoreKey,
} from "../store-registry";
import { calculateBackupChecksum } from "./canonical";
import type { LegacyArchiveEntity } from "../adapters/local/database";

export interface LegacyDetectedStore {
  key: string;
  storeName: string;
  scope?: string;
  isArchived: boolean;
  rawJson: string;
  parsedState?: unknown;
  parsedVersion?: number;
}

export interface LegacyDetectionResult {
  hasLegacyData: boolean;
  detectedScopes: string[];
  hasConflict: boolean;
  unscopedStores: LegacyDetectedStore[];
  scopedStores: Record<string, LegacyDetectedStore[]>;
  archivedStores: LegacyDetectedStore[];
}

/**
 * Extracts store name and optional user scope from a localStorage key.
 * Formats:
 * - "lifeos-notes" -> { storeName: "lifeos-notes", scope: undefined }
 * - "lifeos-usr123-notes" -> { storeName: "lifeos-notes", scope: "usr123" }
 */
export function parseLegacyStorageKey(key: string): { storeName: string; scope?: string } | null {
  if (!key.startsWith("lifeos-") && !key.startsWith("wasl-")) {
    return null;
  }

  // Check direct un-scoped key
  if (isStoreKey(key) || isArchivedStoreKey(key)) {
    return { storeName: key };
  }

  // Check scoped key pattern: lifeos-<scope>-<domain>
  const parts = key.split("-");
  if (parts.length >= 3 && parts[0] === "lifeos") {
    // e.g. lifeos-user1-notes -> domain: "lifeos-notes", scope: "user1"
    const domainPart = parts.slice(2).join("-");
    const candidateStoreName = `lifeos-${domainPart}`;
    if (isStoreKey(candidateStoreName) || isArchivedStoreKey(candidateStoreName)) {
      return {
        storeName: candidateStoreName,
        scope: parts[1],
      };
    }
  }

  return null;
}

/**
 * Inspects a localStorage map/dump to detect legacy LifeOS data and detect any user scope conflicts.
 * Does NOT modify or delete any localStorage keys.
 */
export function detectLegacyLocalStorage(
  storage: Record<string, string>,
): LegacyDetectionResult {
  const unscopedStores: LegacyDetectedStore[] = [];
  const scopedStores: Record<string, LegacyDetectedStore[]> = {};
  const archivedStores: LegacyDetectedStore[] = [];
  const scopeSet = new Set<string>();

  for (const [key, rawJson] of Object.entries(storage)) {
    const parsed = parseLegacyStorageKey(key);
    if (!parsed) continue;

    let parsedState: unknown;
    let parsedVersion: number | undefined;

    try {
      const parsedObj = JSON.parse(rawJson);
      // Zustand persist wraps data in { state: ..., version: ... }
      if (parsedObj && typeof parsedObj === "object" && "state" in parsedObj) {
        parsedState = parsedObj.state;
        parsedVersion = typeof parsedObj.version === "number" ? parsedObj.version : undefined;
      } else {
        parsedState = parsedObj;
      }
    } catch {
      // unparseable json handled gracefully
    }

    const isArchived = isArchivedStoreKey(parsed.storeName);
    const item: LegacyDetectedStore = {
      key,
      storeName: parsed.storeName,
      scope: parsed.scope,
      isArchived,
      rawJson,
      parsedState,
      parsedVersion,
    };

    if (isArchived) {
      archivedStores.push(item);
    }

    if (parsed.scope) {
      scopeSet.add(parsed.scope);
      if (!scopedStores[parsed.scope]) {
        scopedStores[parsed.scope] = [];
      }
      scopedStores[parsed.scope].push(item);
    } else {
      unscopedStores.push(item);
    }
  }

  const detectedScopes = Array.from(scopeSet);
  // Conflict exists if multiple distinct user scopes are present
  const hasConflict = detectedScopes.length > 1;
  const hasLegacyData = unscopedStores.length > 0 || detectedScopes.length > 0 || archivedStores.length > 0;

  return {
    hasLegacyData,
    detectedScopes,
    hasConflict,
    unscopedStores,
    scopedStores,
    archivedStores,
  };
}

export interface ConvertLegacyOptions {
  selectedScope?: string;
  appVersion?: string;
}

/**
 * Converts a legacy localStorage dump into a canonical WaslBackup.
 *
 * Rules:
 * - Requires explicit `selectedScope` if multiple conflicting user scopes exist.
 * - Places archived features (Projects, Routines, Reviews) strictly into `legacyArchives`.
 * - Never modifies or deletes original localStorage keys.
 * - Does NOT perform in-place migrations.
 */
export async function convertLegacyStorageToBackup(
  storage: Record<string, string>,
  options?: ConvertLegacyOptions,
): Promise<{ backup: WaslBackup; legacyArchives: LegacyArchiveEntity[] }> {
  const detection = detectLegacyLocalStorage(storage);

  if (detection.hasConflict && !options?.selectedScope) {
    throw new Error(
      `Multiple conflicting user scopes detected (${detection.detectedScopes.join(", ")}). Please specify a selectedScope.`,
    );
  }

  const activeStoresToInclude: LegacyDetectedStore[] = [];
  const archivedStoresToInclude: LegacyDetectedStore[] = [];

  if (options?.selectedScope) {
    const scopedList = detection.scopedStores[options.selectedScope] ?? [];
    for (const item of scopedList) {
      if (item.isArchived) {
        archivedStoresToInclude.push(item);
      } else {
        activeStoresToInclude.push(item);
      }
    }
    // Also include unscoped archived stores
    for (const item of detection.archivedStores) {
      if (!item.scope && !archivedStoresToInclude.some((a) => a.key === item.key)) {
        archivedStoresToInclude.push(item);
      }
    }
  } else {
    for (const item of detection.unscopedStores) {
      if (item.isArchived) {
        archivedStoresToInclude.push(item);
      } else {
        activeStoresToInclude.push(item);
      }
    }
    for (const item of detection.archivedStores) {
      if (!item.scope && !archivedStoresToInclude.some((a) => a.key === item.key)) {
        archivedStoresToInclude.push(item);
      }
    }
  }

  const now = new Date().toISOString();
  const stores: StoreDocument<StoreKey>[] = [];
  const legacyArchives: LegacyArchiveEntity[] = [];

  // Active stores
  for (const item of activeStoresToInclude) {
    if (!isStoreKey(item.storeName)) continue;

    const store = item.storeName as StoreKey;
    const version = item.parsedVersion ?? getStoreVersion(store);
    const state = (item.parsedState ?? {}) as StoreDocument<typeof store>["state"];

    stores.push({
      store,
      version,
      state,
      updatedAt: now,
    });
  }

  // Archived stores -> legacyArchives
  for (const item of archivedStoresToInclude) {
    legacyArchives.push({
      id: `${item.storeName}-${Date.now()}`,
      createdAt: now,
      source: "legacy-localstorage",
      payload: {
        store: item.storeName as ArchivedStoreKey,
        version: item.parsedVersion ?? 1,
        state: item.parsedState,
        rawKey: item.key,
      },
    });
  }

  // Deterministically sort stores
  stores.sort((a, b) => a.store.localeCompare(b.store));

  const payloadWithoutChecksum: Omit<WaslBackup, "checksum"> = {
    format: "wasl-portable-backup",
    formatVersion: 1,
    appVersion: options?.appVersion ?? "0.1.0",
    exportedAt: now,
    sourceEdition: "local",
    stores,
  };

  const checksum = await calculateBackupChecksum(payloadWithoutChecksum);

  const backup: WaslBackup = {
    ...payloadWithoutChecksum,
    checksum,
  };

  return { backup, legacyArchives };
}
