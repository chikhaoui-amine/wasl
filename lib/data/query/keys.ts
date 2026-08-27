import type { WaslEdition } from "../edition";
import type { StoreKey } from "../store-registry";

/**
 * Standard Query Key factory for WASL data reads and mutations.
 * Format adheres to: ["wasl-store", edition, userId ?? "local", storeKey]
 */
export const queryKeys = {
  all: ["wasl"] as const,

  stores: (edition: WaslEdition, userId?: string | null) =>
    ["wasl-store", edition, userId ?? "local"] as const,

  store: (edition: WaslEdition, userId: string | null | undefined, store: StoreKey) =>
    ["wasl-store", edition, userId ?? "local", store] as const,

  meta: (edition: WaslEdition) =>
    ["wasl-meta", edition] as const,

  preferences: (edition: WaslEdition) =>
    ["wasl-preferences", edition] as const,
};
