import type { RecurringPersistedState } from "../../types";
import { normalizeRecurringState } from "./operations";

export const CURRENT_RECURRING_VERSION = 1;

export function migrateRecurringSnapshot(raw: unknown, fromVersion: number): RecurringPersistedState {
  if (fromVersion > CURRENT_RECURRING_VERSION) {
    throw new Error(
      `Cannot migrate Recurring snapshot from future version ${fromVersion} (current supported version is ${CURRENT_RECURRING_VERSION}).`,
    );
  }

  return normalizeRecurringState(raw);
}
