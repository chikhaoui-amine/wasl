import type { TasksPersistedState } from "../../types";
import { normalizeTasksState } from "./operations";

export const CURRENT_TASKS_VERSION = 3;

export function migrateTasksSnapshot(raw: unknown, fromVersion: number): TasksPersistedState {
  if (fromVersion > CURRENT_TASKS_VERSION) {
    throw new Error(
      `Cannot migrate Tasks snapshot from future version ${fromVersion} (current supported version is ${CURRENT_TASKS_VERSION}).`,
    );
  }

  // v1/v2 -> v3 preserves personal tasks and normalizes daily focus
  return normalizeTasksState(raw);
}
