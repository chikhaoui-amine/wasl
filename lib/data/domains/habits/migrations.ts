import type { HabitsPersistedState } from "../../types";
import { normalizeHabit, createDefaultHabitsState } from "./operations";

export const CURRENT_HABITS_VERSION = 4;

/**
 * Migrates older Habits snapshots in-memory without destructive writes.
 */
export function migrateHabitsSnapshot(
  persisted: unknown,
  fromVersion: number,
): HabitsPersistedState {
  if (fromVersion > CURRENT_HABITS_VERSION) {
    throw new Error(
      `Unsupported future Habits version ${fromVersion}. Current supported version is ${CURRENT_HABITS_VERSION}.`,
    );
  }

  if (!persisted || typeof persisted !== "object") {
    return createDefaultHabitsState();
  }

  const old = persisted as Record<string, unknown> & {
    habits?: Array<Record<string, unknown>>;
  };

  return {
    habits: Array.isArray(old.habits) ? old.habits.map(normalizeHabit) : [],
  };
}
