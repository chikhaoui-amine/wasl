import { describe, it, expect } from "vitest";
import {
  validateStoreDocument,
  validateWaslBackup,
  StoreDocumentSchema,
  WaslBackupSchema,
} from "./schemas";
import { ARCHIVED_STORES } from "./store-registry";

describe("Runtime Schemas", () => {
  it("validates a valid StoreDocument", () => {
    const validDoc = {
      store: "lifeos-notes",
      version: 3,
      state: { notes: [], categories: [] },
      updatedAt: new Date().toISOString(),
      revision: 1,
    };

    const parsed = StoreDocumentSchema.safeParse(validDoc);
    expect(parsed.success).toBe(true);

    const validated = validateStoreDocument(validDoc);
    expect(validated.success).toBe(true);
    expect(validated.data?.store).toBe("lifeos-notes");
  });

  it("rejects an invalid StoreDocument with unknown store key or bad updatedAt", () => {
    const badStore = {
      store: "invalid-store",
      version: 1,
      state: {},
      updatedAt: new Date().toISOString(),
    };
    expect(StoreDocumentSchema.safeParse(badStore).success).toBe(false);

    const badDate = {
      store: "lifeos-notes",
      version: 1,
      state: {},
      updatedAt: "not-a-date",
    };
    expect(StoreDocumentSchema.safeParse(badDate).success).toBe(false);
  });

  it("rejects archived store keys as active StoreDocuments", () => {
    for (const archived of ARCHIVED_STORES) {
      const doc = {
        store: archived,
        version: 1,
        state: {},
        updatedAt: new Date().toISOString(),
      };
      expect(StoreDocumentSchema.safeParse(doc).success).toBe(false);
      expect(validateStoreDocument(doc).success).toBe(false);
    }
  });

  it("validates a valid WaslBackup payload", () => {
    const validBackup = {
      format: "wasl-portable-backup",
      formatVersion: 1,
      appVersion: "0.1.0",
      exportedAt: new Date().toISOString(),
      sourceEdition: "local",
      stores: [
        {
          store: "lifeos-notes",
          version: 3,
          state: { notes: [], categories: [] },
          updatedAt: new Date().toISOString(),
        },
      ],
      preferences: { theme: "graphite" },
      checksum: "a".repeat(64),
    };

    const parsed = WaslBackupSchema.safeParse(validBackup);
    expect(parsed.success).toBe(true);

    const validated = validateWaslBackup(validBackup);
    expect(validated.success).toBe(true);
    expect(validated.data?.sourceEdition).toBe("local");
  });

  it("rejects invalid WaslBackup format version or wrong checksum length", () => {
    const badBackup = {
      format: "wasl-portable-backup",
      formatVersion: 2, // only 1 is supported
      appVersion: "0.1.0",
      exportedAt: new Date().toISOString(),
      sourceEdition: "local",
      stores: [],
      checksum: "too-short",
    };

    const validated = validateWaslBackup(badBackup);
    expect(validated.success).toBe(false);
    expect(validated.error).toBeDefined();
  });
});
