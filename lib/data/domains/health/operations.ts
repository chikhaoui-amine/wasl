import type { HealthPersistedState } from "../../types";
import type {
  HealthDay,
  Workout,
  WorkoutProgram,
  Exercise,
  ActiveWorkout,
  LoggedExercise,
  LoggedSet,
} from "./types";
import {
  DEFAULT_EXERCISES,
  DEFAULT_PROGRAMS,
  SPORTS,
} from "./constants";
import {
  weightSeries,
  thisWeekActivity,
  sportsHeatmap,
  sportBreakdown,
  getExerciseTrackingMode,
  extractAllPRs,
  sleepSeries,
  exerciseProgression,
  getAvailableExercises,
  formatSetSummary,
  calc1RM,
  lastNDays,
  hasAnyLog,
} from "./utils";
import { todayISO } from "@/lib/date";

export {
  DEFAULT_EXERCISES,
  DEFAULT_PROGRAMS,
  SPORTS,
  getExerciseTrackingMode,
  lastNDays,
  hasAnyLog,
  weightSeries,
  thisWeekActivity,
  sportsHeatmap,
  sportBreakdown,
  extractAllPRs,
  sleepSeries,
  exerciseProgression,
  getAvailableExercises,
  formatSetSummary,
  calc1RM,
};

export function createDefaultHealthState(): HealthPersistedState {
  const t = todayISO();
  const d1 = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const d2 = new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10);

  return {
    days: {
      [d2]: {
        steps: 9450,
        waterCups: 9,
        sleepH: 7.8,
        weightKg: 76.2,
        energy: 4,
        sleepQuality: "Restful & deep",
        sleepNote: "Fell asleep quickly after wind-down routine",
      },
      [d1]: {
        steps: 11200,
        waterCups: 10,
        sleepH: 8.1,
        weightKg: 76.0,
        energy: 5,
        sleepQuality: "Great recovery",
        sleepNote: "Woke up energized and ready for morning run",
      },
      [t]: {
        steps: 7800,
        waterCups: 8,
        sleepH: 7.5,
        weightKg: 75.9,
        energy: 4,
      },
    },
    workouts: [
      {
        id: "workout-sample-1",
        date: d1,
        sport: "Running",
        minutes: 42,
        intensity: "moderate",
        distanceKm: 5.2,
        detailedExercises: [
          {
            exerciseId: "ex-run",
            exerciseName: "Outdoor Running",
            trackingMode: "cardio_set",
            sets: [
              {
                id: "set-run-1",
                weightKg: 0,
                reps: 1,
                distanceMeters: 5200,
                durationSec: 2520,
                rpe: 6,
                completed: true,
              },
            ],
          },
        ],
      },
      {
        id: "workout-sample-2",
        date: d2,
        sport: "Gym",
        minutes: 55,
        intensity: "vigorous",
        detailedExercises: [
          {
            exerciseId: "ex-bench-press",
            exerciseName: "Barbell Bench Press",
            trackingMode: "weight_reps",
            sets: [
              { id: "set-b-1", reps: 8, weightKg: 70, rpe: 7, completed: true },
              { id: "set-b-2", reps: 8, weightKg: 75, rpe: 8, completed: true },
              { id: "set-b-3", reps: 6, weightKg: 80, rpe: 8.5, completed: true },
            ],
          },
        ],
      },
    ],
    customSports: ["Gym", "Calisthenics", "Running", "Swimming", "Martial arts"],
    exercises: DEFAULT_EXERCISES,
    programs: DEFAULT_PROGRAMS,
    goals: { steps: 8000, waterCups: 8, sleepH: 8, sessionsPerWeek: 4 },
    activeWorkout: null,
  };
}

export function normalizeHealthState(current: unknown): HealthPersistedState {
  if (!current || typeof current !== "object") {
    return createDefaultHealthState();
  }
  const s = current as Partial<HealthPersistedState> & Record<string, unknown>;
  return {
    days: (s.days && typeof s.days === "object" ? s.days : {}) as Record<string, HealthDay>,
    workouts: Array.isArray(s.workouts) ? s.workouts : [],
    customSports: Array.isArray(s.customSports)
      ? s.customSports
      : ["Gym", "Calisthenics", "Running", "Swimming", "Martial arts"],
    exercises: Array.isArray(s.exercises) ? s.exercises : DEFAULT_EXERCISES,
    programs: Array.isArray(s.programs) ? s.programs : DEFAULT_PROGRAMS,
    goals: s.goals && typeof s.goals === "object" ? s.goals : { steps: 8000, waterCups: 8, sleepH: 8, sessionsPerWeek: 3 },
    activeWorkout: s.activeWorkout && typeof s.activeWorkout === "object" ? (s.activeWorkout as ActiveWorkout) : null,
  };
}

/**
 * Pure operation to patch metrics for a specific date in HealthDay.
 */
export function patchDayOperation(
  current: HealthPersistedState | null | undefined,
  patch: Partial<HealthDay>,
  date: string = todayISO(),
): HealthPersistedState {
  const base = normalizeHealthState(current);
  const existingDay = base.days[date] ?? { steps: 0, sleepH: 0, waterCups: 0 };
  return {
    ...base,
    days: {
      ...base.days,
      [date]: { ...existingDay, ...patch },
    },
  };
}

/**
 * Pure operation to add a workout log (and update HealthDay soreness/energy).
 */
export function addWorkoutOperation(
  current: HealthPersistedState | null | undefined,
  workout: Workout,
): HealthPersistedState {
  const base = normalizeHealthState(current);
  const dayPatch: Partial<HealthDay> = {};
  if (workout.soreness !== undefined) dayPatch.soreness = workout.soreness;
  if (workout.energy !== undefined) dayPatch.energy = workout.energy;

  const updatedDays =
    Object.keys(dayPatch).length > 0
      ? {
          ...base.days,
          [workout.date]: { ...(base.days[workout.date] ?? { steps: 0, sleepH: 0, waterCups: 0 }), ...dayPatch },
        }
      : base.days;

  return {
    ...base,
    workouts: [workout, ...base.workouts],
    days: updatedDays,
  };
}

/**
 * Pure operation to delete a workout log.
 */
export function deleteWorkoutOperation(
  current: HealthPersistedState | null | undefined,
  id: string,
): HealthPersistedState {
  const base = normalizeHealthState(current);
  return {
    ...base,
    workouts: base.workouts.filter((w) => w.id !== id),
  };
}

/**
 * Pure operation to add a custom exercise.
 */
export function addExerciseOperation(
  current: HealthPersistedState | null | undefined,
  exercise: Exercise,
): HealthPersistedState {
  const base = normalizeHealthState(current);
  return {
    ...base,
    exercises: [...(base.exercises ?? DEFAULT_EXERCISES), exercise],
  };
}

/**
 * Pure operation to add a workout program.
 */
export function addProgramOperation(
  current: HealthPersistedState | null | undefined,
  program: WorkoutProgram,
): HealthPersistedState {
  const base = normalizeHealthState(current);
  const updatedPrograms = program.active
    ? base.programs.map((p) => ({ ...p, active: false }))
    : base.programs;

  return {
    ...base,
    programs: [...updatedPrograms, program],
  };
}

/**
 * Pure operation to update a workout program.
 */
export function updateProgramOperation(
  current: HealthPersistedState | null | undefined,
  id: string,
  patch: Partial<WorkoutProgram>,
): HealthPersistedState {
  const base = normalizeHealthState(current);
  return {
    ...base,
    programs: base.programs.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  };
}

/**
 * Pure operation to delete a workout program.
 */
export function deleteProgramOperation(
  current: HealthPersistedState | null | undefined,
  id: string,
): HealthPersistedState {
  const base = normalizeHealthState(current);
  return {
    ...base,
    programs: base.programs.filter((p) => p.id !== id),
  };
}

/**
 * Pure operation to set the active workout program.
 */
export function setActiveProgramOperation(
  current: HealthPersistedState | null | undefined,
  id: string,
): HealthPersistedState {
  const base = normalizeHealthState(current);
  return {
    ...base,
    programs: base.programs.map((p) => ({
      ...p,
      active: p.id === id,
    })),
  };
}

/* ============================================================
 * ACTIVE WORKOUT OPERATIONS
 * ============================================================ */

export function startActiveWorkoutOperation(
  current: HealthPersistedState | null | undefined,
  activeWorkout: ActiveWorkout,
): HealthPersistedState {
  const base = normalizeHealthState(current);
  return {
    ...base,
    activeWorkout,
  };
}

export function updateActiveWorkoutOperation(
  current: HealthPersistedState | null | undefined,
  patchOrUpdater:
    | Partial<ActiveWorkout>
    | ((prev: ActiveWorkout) => Partial<ActiveWorkout>),
): HealthPersistedState {
  const base = normalizeHealthState(current);
  if (!base.activeWorkout) return base;
  const patch =
    typeof patchOrUpdater === "function"
      ? patchOrUpdater(base.activeWorkout)
      : patchOrUpdater;
  return {
    ...base,
    activeWorkout: {
      ...base.activeWorkout,
      ...patch,
    },
  };
}

export function pauseActiveWorkoutOperation(
  current: HealthPersistedState | null | undefined,
  now: number = Date.now(),
): HealthPersistedState {
  const base = normalizeHealthState(current);
  if (!base.activeWorkout || base.activeWorkout.isPaused) return base;
  const additional = Math.max(0, Math.floor((now - base.activeWorkout.lastTickAt) / 1000));
  return {
    ...base,
    activeWorkout: {
      ...base.activeWorkout,
      elapsedSec: (base.activeWorkout.elapsedSec || 0) + additional,
      isPaused: true,
      lastTickAt: now,
    },
  };
}

export function resumeActiveWorkoutOperation(
  current: HealthPersistedState | null | undefined,
  now: number = Date.now(),
): HealthPersistedState {
  const base = normalizeHealthState(current);
  if (!base.activeWorkout || !base.activeWorkout.isPaused) return base;
  return {
    ...base,
    activeWorkout: {
      ...base.activeWorkout,
      isPaused: false,
      lastTickAt: now,
    },
  };
}

/**
 * Derives displayed elapsed seconds and remaining rest seconds in UI
 * from persisted timestamps + in-memory clock without database writes.
 */
export function getDisplayedWorkoutSeconds(
  activeWorkout: ActiveWorkout | null | undefined,
  now: number = Date.now(),
): { elapsedSec: number; restTimerSec: number | null } {
  if (!activeWorkout) return { elapsedSec: 0, restTimerSec: null };
  const currentRun = activeWorkout.isPaused
    ? 0
    : Math.max(0, Math.floor((now - activeWorkout.lastTickAt) / 1000));
  const elapsedSec = (activeWorkout.elapsedSec || 0) + currentRun;

  let restTimerSec: number | null = null;
  if (activeWorkout.restTimerTarget && activeWorkout.restTimerTarget > now) {
    restTimerSec = Math.ceil((activeWorkout.restTimerTarget - now) / 1000);
  }
  return { elapsedSec, restTimerSec };
}

export function tickActiveWorkoutOperation(
  current: HealthPersistedState | null | undefined,
): HealthPersistedState {
  // Kept for backward compatibility if ever needed; no-op in modern adapter architecture
  return normalizeHealthState(current);
}

export function setRestTimerOperation(
  current: HealthPersistedState | null | undefined,
  seconds: number | null,
  now: number = Date.now(),
): HealthPersistedState {
  const base = normalizeHealthState(current);
  if (!base.activeWorkout) return base;
  return {
    ...base,
    activeWorkout: {
      ...base.activeWorkout,
      restTimerSec: seconds,
      restTimerTarget: seconds && seconds > 0 ? now + seconds * 1000 : null,
    },
  };
}

export function minimizeActiveWorkoutOperation(
  current: HealthPersistedState | null | undefined,
): HealthPersistedState {
  const base = normalizeHealthState(current);
  if (!base.activeWorkout) return base;
  return {
    ...base,
    activeWorkout: { ...base.activeWorkout, isMinimized: true },
  };
}

export function expandActiveWorkoutOperation(
  current: HealthPersistedState | null | undefined,
): HealthPersistedState {
  const base = normalizeHealthState(current);
  if (!base.activeWorkout) return base;
  return {
    ...base,
    activeWorkout: { ...base.activeWorkout, isMinimized: false },
  };
}

export function updateLoggedExerciseOperation(
  current: HealthPersistedState | null | undefined,
  exerciseIndex: number,
  updater: (ex: LoggedExercise) => LoggedExercise,
): HealthPersistedState {
  const base = normalizeHealthState(current);
  if (!base.activeWorkout) return base;
  const exercises = [...base.activeWorkout.loggedExercises];
  if (!exercises[exerciseIndex]) return base;
  exercises[exerciseIndex] = updater(exercises[exerciseIndex]);
  return {
    ...base,
    activeWorkout: { ...base.activeWorkout, loggedExercises: exercises },
  };
}

export function updateLoggedSetOperation(
  current: HealthPersistedState | null | undefined,
  exerciseIndex: number,
  setIndex: number,
  patch: Partial<LoggedSet>,
): HealthPersistedState {
  const base = normalizeHealthState(current);
  if (!base.activeWorkout) return base;
  const exercises = [...base.activeWorkout.loggedExercises];
  const targetEx = exercises[exerciseIndex];
  if (!targetEx || !targetEx.sets[setIndex]) return base;

  const sets = [...targetEx.sets];
  sets[setIndex] = { ...sets[setIndex], ...patch };
  exercises[exerciseIndex] = { ...targetEx, sets };

  return {
    ...base,
    activeWorkout: { ...base.activeWorkout, loggedExercises: exercises },
  };
}

export function addSetToLoggedExerciseOperation(
  current: HealthPersistedState | null | undefined,
  exerciseIndex: number,
  newSet: LoggedSet,
): HealthPersistedState {
  const base = normalizeHealthState(current);
  if (!base.activeWorkout) return base;
  const exercises = [...base.activeWorkout.loggedExercises];
  const targetEx = exercises[exerciseIndex];
  if (!targetEx) return base;

  exercises[exerciseIndex] = {
    ...targetEx,
    sets: [...targetEx.sets, newSet],
  };

  return {
    ...base,
    activeWorkout: { ...base.activeWorkout, loggedExercises: exercises },
  };
}

export function removeSetFromLoggedExerciseOperation(
  current: HealthPersistedState | null | undefined,
  exerciseIndex: number,
  setIndex: number,
): HealthPersistedState {
  const base = normalizeHealthState(current);
  if (!base.activeWorkout) return base;
  const exercises = [...base.activeWorkout.loggedExercises];
  const targetEx = exercises[exerciseIndex];
  if (!targetEx || targetEx.sets.length <= 1) return base;

  exercises[exerciseIndex] = {
    ...targetEx,
    sets: targetEx.sets.filter((_, idx) => idx !== setIndex),
  };

  return {
    ...base,
    activeWorkout: { ...base.activeWorkout, loggedExercises: exercises },
  };
}

export function addExerciseToActiveWorkoutOperation(
  current: HealthPersistedState | null | undefined,
  newExercise: LoggedExercise,
): HealthPersistedState {
  const base = normalizeHealthState(current);
  if (!base.activeWorkout) return base;
  return {
    ...base,
    activeWorkout: {
      ...base.activeWorkout,
      loggedExercises: [...base.activeWorkout.loggedExercises, newExercise],
    },
  };
}

export function removeExerciseFromActiveWorkoutOperation(
  current: HealthPersistedState | null | undefined,
  exerciseIndex: number,
): HealthPersistedState {
  const base = normalizeHealthState(current);
  if (!base.activeWorkout) return base;
  return {
    ...base,
    activeWorkout: {
      ...base.activeWorkout,
      loggedExercises: base.activeWorkout.loggedExercises.filter((_, idx) => idx !== exerciseIndex),
    },
  };
}

export function reorderLoggedExercisesOperation(
  current: HealthPersistedState | null | undefined,
  newOrder: LoggedExercise[],
): HealthPersistedState {
  const base = normalizeHealthState(current);
  if (!base.activeWorkout) return base;
  return {
    ...base,
    activeWorkout: {
      ...base.activeWorkout,
      loggedExercises: newOrder,
    },
  };
}

export function updateActiveWorkoutNotesOperation(
  current: HealthPersistedState | null | undefined,
  notes: string,
): HealthPersistedState {
  const base = normalizeHealthState(current);
  if (!base.activeWorkout) return base;
  return {
    ...base,
    activeWorkout: { ...base.activeWorkout, notes },
  };
}

export function updateActiveSportMetricsOperation(
  current: HealthPersistedState | null | undefined,
  metrics: Record<string, unknown>,
): HealthPersistedState {
  const base = normalizeHealthState(current);
  if (!base.activeWorkout) return base;
  return {
    ...base,
    activeWorkout: {
      ...base.activeWorkout,
      sportMetrics: { ...base.activeWorkout.sportMetrics, ...metrics },
    },
  };
}

export function cancelActiveWorkoutOperation(
  current: HealthPersistedState | null | undefined,
): HealthPersistedState {
  const base = normalizeHealthState(current);
  return {
    ...base,
    activeWorkout: null,
  };
}

export function finishActiveWorkoutOperation(
  current: HealthPersistedState | null | undefined,
  newWorkout: Workout,
): HealthPersistedState {
  const base = normalizeHealthState(current);
  return {
    ...base,
    workouts: [newWorkout, ...base.workouts],
    activeWorkout: null,
  };
}
