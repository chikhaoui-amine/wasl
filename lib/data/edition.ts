export type WaslEdition = "local";

export const DEFAULT_EDITION: WaslEdition = "local";

/**
 * Returns the currently active WASL edition. Always "local" in WASL Local.
 */
export function getEdition(): WaslEdition {
  return "local";
}

/**
 * Returns true if running in Local Edition. Always true in WASL Local.
 */
export function isLocalEdition(): boolean {
  return true;
}

/**
 * Returns true if running in Cloud Edition. Always false in WASL Local.
 */
export function isCloudEdition(): boolean {
  return false;
}

export interface EditionConfigValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Validates environment requirements for Local Edition.
 * Local Edition requires zero remote service credentials.
 */
export function validateEditionConfig(): EditionConfigValidation {
  return {
    valid: true,
    errors: [],
  };
}

/**
 * Asserts that the environment is valid for Local Edition.
 */
export function assertValidEditionConfig(): void {
  // No-op in Local Edition: zero configuration required
}
