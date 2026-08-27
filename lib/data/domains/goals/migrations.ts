import type { GoalsPersistedState } from "../../types";
import { normalizeGoalsState } from "./operations";

export const CURRENT_GOALS_VERSION = 6;

export function migrateGoalsSnapshot(raw: unknown, fromVersion: number): GoalsPersistedState {
  if (fromVersion > CURRENT_GOALS_VERSION) {
    throw new Error(
      `Cannot migrate Goals snapshot from future version ${fromVersion} (current supported version is ${CURRENT_GOALS_VERSION}).`,
    );
  }

  // Versions 1 through 6 are fully handled by normalizeGoalsState which:
  // - Converts legacy 'project' types into 'yearly_outcome'
  // - Maps legacy categories to valid NorthStar presets
  // - Ensures milestones, manualProgress, status, and completed fields
  return normalizeGoalsState(raw);
}
