import type { HealthPersistedState } from "../../types";
import type { HealthDay, Workout, WorkoutProgram, Exercise, ActiveWorkout } from "./types";
import { DEFAULT_EXERCISES, DEFAULT_PROGRAMS, createDefaultHealthState } from "./operations";

export const CURRENT_HEALTH_VERSION = 6;

/**
 * Migrates older Health snapshots in-memory without destructive writes.
 */
export function migrateHealthSnapshot(
  persisted: unknown,
  fromVersion: number,
): HealthPersistedState {
  if (fromVersion > CURRENT_HEALTH_VERSION) {
    throw new Error(
      `Unsupported future Health version ${fromVersion}. Current supported version is ${CURRENT_HEALTH_VERSION}.`,
    );
  }

  if (!persisted || typeof persisted !== "object") {
    return createDefaultHealthState();
  }

  const old = persisted as Record<string, unknown> & {
    days?: Record<string, HealthDay>;
    workouts?: Workout[];
    customSports?: string[];
    exercises?: Exercise[];
    programs?: WorkoutProgram[];
    goals?: { steps: number; waterCups: number; sleepH: number; sessionsPerWeek: number };
    activeWorkout?: ActiveWorkout | null;
  };

  return {
    ...old,
    days: old.days && typeof old.days === "object" ? old.days : {},
    workouts: Array.isArray(old.workouts) ? old.workouts : [],
    customSports: Array.isArray(old.customSports)
      ? old.customSports
      : ["Gym", "Calisthenics", "Running", "Swimming", "Martial arts"],
    exercises: Array.isArray(old.exercises) ? old.exercises : DEFAULT_EXERCISES,
    programs: Array.isArray(old.programs) && old.programs.length > 0
      ? old.programs
      : DEFAULT_PROGRAMS,
    goals: old.goals && typeof old.goals === "object"
      ? old.goals
      : { steps: 8000, waterCups: 8, sleepH: 8, sessionsPerWeek: 3 },
    activeWorkout: old.activeWorkout && typeof old.activeWorkout === "object" ? old.activeWorkout : null,
  };
}
