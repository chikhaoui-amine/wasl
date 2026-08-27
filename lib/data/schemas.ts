import { z } from "zod";
import {
  isStoreKey,
  isArchivedStoreKey,
  type StoreKey,
  type ArchivedStoreKey,
} from "./store-registry";
import type { StoreDocument, WaslBackup } from "./types";

export const EditionSchema = z.enum(["local", "cloud"]);

export const StoreKeySchema = z.custom<StoreKey>(
  (val) => typeof val === "string" && isStoreKey(val),
  { message: "Invalid StoreKey" },
);

export const ArchivedStoreKeySchema = z.custom<ArchivedStoreKey>(
  (val) => typeof val === "string" && isArchivedStoreKey(val),
  { message: "Invalid ArchivedStoreKey" },
);

/**
 * Validates a single persisted StoreDocument envelope.
 *
 * Scope note:
 * This schema validates the document container envelope (valid registered store key, non-negative integer version,
 * object state container, and valid ISO updatedAt timestamp). Full domain-specific entity schema validation and migration
 * are handled per-domain in subsequent migration phases.
 */
export const StoreDocumentSchema = z.object({
  store: StoreKeySchema,
  version: z.number().int().nonnegative(),
  state: z.record(z.string(), z.unknown()),
  updatedAt: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
    message: "updatedAt must be a valid ISO date string",
  }),
  revision: z.number().int().nonnegative().optional(),
});

/**
 * Validates the portable backup format (v1).
 */
export const WaslBackupSchema = z.object({
  format: z.literal("wasl-portable-backup"),
  formatVersion: z.literal(1),
  appVersion: z.string().min(1),
  exportedAt: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
    message: "exportedAt must be a valid ISO date string",
  }),
  sourceEdition: EditionSchema,
  stores: z.array(StoreDocumentSchema),
  preferences: z.record(z.string(), z.unknown()).optional(),
  checksum: z.string().length(64, "Checksum must be a 64-character hex SHA-256 string"),
});

/**
 * Safe validator for a StoreDocument envelope.
 */
export function validateStoreDocument(doc: unknown): {
  success: boolean;
  data?: StoreDocument;
  error?: string;
} {
  const result = StoreDocumentSchema.safeParse(doc);
  if (result.success) {
    return { success: true, data: result.data as unknown as StoreDocument };
  }
  return {
    success: false,
    error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
  };
}

/**
 * Safe validator for a WaslBackup container.
 */
export function validateWaslBackup(backup: unknown): {
  success: boolean;
  data?: WaslBackup;
  error?: string;
} {
  const result = WaslBackupSchema.safeParse(backup);
  if (result.success) {
    return { success: true, data: result.data as unknown as WaslBackup };
  }
  return {
    success: false,
    error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
  };
}

/**
 * Validates the selective transfer package format (v1).
 */
export const WaslTransferSchema = z.object({
  format: z.literal("wasl-selective-transfer"),
  formatVersion: z.literal(1),
  appVersion: z.string().min(1),
  exportedAt: z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
    message: "exportedAt must be a valid ISO date string",
  }),
  sourceEdition: EditionSchema,
  selection: z.object({
    domains: z.array(StoreKeySchema).optional(),
    entities: z.record(z.string(), z.array(z.string())).optional(),
  }),
  stores: z.array(StoreDocumentSchema),
  preferences: z.record(z.string(), z.unknown()).optional(),
  checksum: z.string().length(64, "Checksum must be a 64-character hex SHA-256 string"),
});

/**
 * Safe validator for a WaslTransfer container.
 */
export function validateWaslTransfer(transfer: unknown): {
  success: boolean;
  data?: import("./types").WaslTransfer;
  error?: string;
} {
  const result = WaslTransferSchema.safeParse(transfer);
  if (result.success) {
    return { success: true, data: result.data as unknown as import("./types").WaslTransfer };
  }
  return {
    success: false,
    error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
  };
}
