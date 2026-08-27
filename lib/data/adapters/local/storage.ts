export interface StorageEstimateResult {
  quota?: number;
  usage?: number;
  percentage?: number;
}

/**
 * Requests persistent storage from the browser to prevent eviction under storage pressure.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.storage && typeof navigator.storage.persist === "function") {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Checks whether persistent storage is already granted.
 */
export async function isStoragePersisted(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.storage && typeof navigator.storage.persisted === "function") {
    try {
      return await navigator.storage.persisted();
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Retrieves storage quota and usage estimates if supported by the browser.
 */
export async function getStorageEstimate(): Promise<StorageEstimateResult> {
  if (typeof navigator !== "undefined" && navigator.storage && typeof navigator.storage.estimate === "function") {
    try {
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota;
      const usage = estimate.usage;
      const percentage = quota && usage !== undefined ? Math.round((usage / quota) * 100) : undefined;
      return { quota, usage, percentage };
    } catch {
      return {};
    }
  }
  return {};
}
