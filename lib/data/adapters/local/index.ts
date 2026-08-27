export { LocalAdapter, type LocalAdapterOptions } from "./local-adapter";
export {
  WaslLocalDatabase,
  getLocalDatabase,
  type DocumentEntity,
  type MetadataEntity,
  type PreferenceEntity,
  type LegacyArchiveEntity,
} from "./database";
export {
  requestPersistentStorage,
  isStoragePersisted,
  getStorageEstimate,
  type StorageEstimateResult,
} from "./storage";
export {
  resetLocalDatabase,
  isLocalDatabaseEmpty,
} from "./maintenance";

