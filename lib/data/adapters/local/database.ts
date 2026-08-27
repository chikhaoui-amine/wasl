import Dexie, { type Table, type DexieOptions } from "dexie";
import type { StoreKey } from "../../store-registry";
import type { StoreStateMap } from "../../types";

export interface DocumentEntity<K extends StoreKey = StoreKey> {
  store: K;
  version: number;
  state: StoreStateMap[K];
  updatedAt: string;
  revision: number;
}

export interface MetadataEntity {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface PreferenceEntity {
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface LegacyArchiveEntity {
  id: string;
  createdAt: string;
  source: string;
  payload: unknown;
}

/**
 * Dexie database implementation for WASL Local Edition.
 * Database name: "wasl-local"
 *
 * Version 1 schema:
 * - documents: "&store, version, updatedAt"
 * - metadata: "&key"
 * - preferences: "&key"
 * - legacyArchives: "&id, createdAt, source"
 */
export class WaslLocalDatabase extends Dexie {
  documents!: Table<DocumentEntity, string>;
  metadata!: Table<MetadataEntity, string>;
  preferences!: Table<PreferenceEntity, string>;
  legacyArchives!: Table<LegacyArchiveEntity, string>;

  constructor(databaseName = "wasl-local", options?: DexieOptions) {
    super(databaseName, options);

    this.version(1).stores({
      documents: "&store, version, updatedAt",
      metadata: "&key",
      preferences: "&key",
      legacyArchives: "&id, createdAt, source",
    });
  }
}

let defaultDb: WaslLocalDatabase | null = null;

export function getLocalDatabase(name = "wasl-local"): WaslLocalDatabase {
  if (!defaultDb || defaultDb.name !== name) {
    defaultDb = new WaslLocalDatabase(name);
  }
  return defaultDb;
}
