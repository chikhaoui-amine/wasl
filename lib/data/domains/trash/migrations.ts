import type { TrashPersistedState } from "../../types";
import { normalizeTrashState } from "./operations";

export const CURRENT_TRASH_VERSION = 1;

export function migrateTrashSnapshot(raw: unknown, fromVersion: number): TrashPersistedState {
  if (fromVersion > CURRENT_TRASH_VERSION) {
    throw new Error(
      `Cannot migrate Trash snapshot from future version ${fromVersion} (current supported version is ${CURRENT_TRASH_VERSION}).`,
    );
  }

  return normalizeTrashState(raw);
}
