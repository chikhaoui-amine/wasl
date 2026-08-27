import type { WaslBackup } from "../types";

/**
 * Recursively canonicalizes a JavaScript value into a deterministic structure:
 * - Object keys are sorted alphabetically.
 * - Array element order is strictly preserved.
 * - Undefined values in objects are omitted.
 * - Primitives (string, number, boolean, null) are preserved.
 */
export function canonicalizeValue(val: unknown): unknown {
  if (val === null || typeof val !== "object") {
    return val;
  }

  if (Array.isArray(val)) {
    return val.map((item) => canonicalizeValue(item));
  }

  const sortedObj: Record<string, unknown> = {};
  const keys = Object.keys(val as Record<string, unknown>).sort();

  for (const key of keys) {
    const value = (val as Record<string, unknown>)[key];
    if (value !== undefined) {
      sortedObj[key] = canonicalizeValue(value);
    }
  }

  return sortedObj;
}

/**
 * Returns the canonical JSON string representation of a value.
 */
export function canonicalizeJson(val: unknown): string {
  return JSON.stringify(canonicalizeValue(val));
}

/**
 * Computes a SHA-256 hex digest of a UTF-8 string across Node and browser environments.
 */
export async function computeSha256Hex(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);

  // Modern browser and Node 18+ Web Crypto API
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback for older Node environments
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require("node:crypto");
  return nodeCrypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Calculates the SHA-256 checksum over a WaslBackup structure excluding the `checksum` field itself.
 */
export async function calculateBackupChecksum(
  backupWithoutChecksum: Omit<WaslBackup, "checksum">,
): Promise<string> {
  const canonicalString = canonicalizeJson(backupWithoutChecksum);
  return computeSha256Hex(canonicalString);
}

/**
 * Verifies that a WaslBackup has a valid, untampered SHA-256 checksum.
 */
export async function verifyBackupChecksum(backup: WaslBackup): Promise<boolean> {
  if (!backup || typeof backup.checksum !== "string" || backup.checksum.length !== 64) {
    return false;
  }

  const { checksum: expectedChecksum, ...payloadWithoutChecksum } = backup;
  const computedChecksum = await calculateBackupChecksum(payloadWithoutChecksum);

  return computedChecksum.toLowerCase() === expectedChecksum.toLowerCase();
}
