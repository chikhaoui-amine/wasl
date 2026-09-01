import { describe, it, expect } from "vitest";
import {
  STORE_REGISTRY,
  STORE_KEYS,
  ARCHIVED_STORES,
  isStoreKey,
  isArchivedStoreKey,
  getStoreLifecycle,
  ACTIVE_STORE_COUNT,
  getStoreVersion,
} from "./store-registry";

describe("Store Registry", () => {
  it("contains exactly the 11 active domain stores", () => {
    expect(ACTIVE_STORE_COUNT).toBe(11);
    expect(STORE_KEYS).toHaveLength(11);
    expect(Object.keys(STORE_REGISTRY)).toHaveLength(11);
    expect(STORE_KEYS).toContain("lifeos-notes");
    expect(STORE_KEYS).toContain("lifeos-trash");
    expect(STORE_KEYS).toContain("lifeos-health");
    expect(STORE_KEYS).toContain("lifeos-topics");
    expect(STORE_KEYS).toContain("lifeos-goals");
    expect(STORE_KEYS).toContain("lifeos-tasks");
    expect(STORE_KEYS).toContain("lifeos-blocks");
    expect(STORE_KEYS).toContain("lifeos-journal");
    expect(STORE_KEYS).toContain("lifeos-habits");
    expect(STORE_KEYS).toContain("lifeos-money");
    expect(STORE_KEYS).toContain("lifeos-recurring");
  });

  it("maintains verified schema versions matching active code", () => {
    expect(getStoreVersion("lifeos-notes")).toBe(3);
    expect(getStoreVersion("lifeos-trash")).toBe(1);
    expect(getStoreVersion("lifeos-health")).toBe(6);
    expect(getStoreVersion("lifeos-topics")).toBe(4);
    expect(getStoreVersion("lifeos-goals")).toBe(6);
    expect(getStoreVersion("lifeos-tasks")).toBe(3);
    expect(getStoreVersion("lifeos-blocks")).toBe(3);
    expect(getStoreVersion("lifeos-journal")).toBe(2);
    expect(getStoreVersion("lifeos-habits")).toBe(4);
    expect(getStoreVersion("lifeos-money")).toBe(4);
    expect(getStoreVersion("lifeos-recurring")).toBe(1);
  });

  it("contains archived stores without exposing them as active", () => {
    expect(ARCHIVED_STORES).toContain("lifeos-projects");
    expect(ARCHIVED_STORES).toContain("lifeos-routines");
    expect(ARCHIVED_STORES).toContain("lifeos-reviews");
    expect(ARCHIVED_STORES).toContain("lifeos-deen");

    for (const archived of ARCHIVED_STORES) {
      expect(isStoreKey(archived)).toBe(false);
      expect(isArchivedStoreKey(archived)).toBe(true);
    }
  });

  it("correctly identifies valid and invalid store keys", () => {
    expect(isStoreKey("lifeos-notes")).toBe(true);
    expect(isStoreKey("lifeos-unknown")).toBe(false);
    expect(isStoreKey("")).toBe(false);
    expect(getStoreLifecycle("lifeos-notes")).toBe("active");
    expect(getStoreLifecycle("lifeos-projects")).toBe("archived");
    expect(getStoreLifecycle("lifeos-unknown")).toBe("unknown");
  });
});
