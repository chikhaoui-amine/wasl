import type { BlocksPersistedState } from "../../types";
import { normalizeBlocksState } from "./operations";

export const CURRENT_BLOCKS_VERSION = 3;

export function migrateBlocksSnapshot(raw: unknown, fromVersion: number): BlocksPersistedState {
  if (fromVersion > CURRENT_BLOCKS_VERSION) {
    throw new Error(
      `Cannot migrate Blocks snapshot from future version ${fromVersion} (current supported version is ${CURRENT_BLOCKS_VERSION}).`,
    );
  }

  return normalizeBlocksState(raw);
}
