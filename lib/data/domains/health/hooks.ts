"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  useDataAdapter,
  useDataEdition,
  useDataUserId,
} from "../../query/provider";
import { queryKeys } from "../../query/keys";
import { useSerializedMutations } from "../../query/mutation-queue";
import { deleteEntityWithTrash, restoreDefaultProgramsService } from "../trash";
import {
  createDefaultHealthState,
  normalizeHealthState,
  patchDayOperation,
  addWorkoutOperation,
  deleteWorkoutOperation,
  addExerciseOperation,
  addProgramOperation,
  updateProgramOperation,
  deleteProgramOperation,
  setActiveProgramOperation,
  startActiveWorkoutOperation,
  updateActiveWorkoutOperation,
  pauseActiveWorkoutOperation,
  resumeActiveWorkoutOperation,
  tickActiveWorkoutOperation,
  setRestTimerOperation,
  minimizeActiveWorkoutOperation,
  expandActiveWorkoutOperation,
  updateLoggedExerciseOperation,
  updateLoggedSetOperation,
  addSetToLoggedExerciseOperation,
  removeSetFromLoggedExerciseOperation,
  addExerciseToActiveWorkoutOperation,
  removeExerciseFromActiveWorkoutOperation,
  reorderLoggedExercisesOperation,
  updateActiveWorkoutNotesOperation,
  updateActiveSportMetricsOperation,
  cancelActiveWorkoutOperation,
  finishActiveWorkoutOperation,
  getExerciseTrackingMode,
  getDisplayedWorkoutSeconds,
} from "./operations";
import type {
  HealthDay,
  Workout,
  WorkoutProgram,
  Exercise,
  ActiveWorkout,
  LoggedExercise,
  LoggedSet,
  TargetSet,
  ProgramSession,
} from "./types";
import { todayISO } from "@/lib/date";

export function useHealthData() {
  const adapter = useDataAdapter();
  const edition = useDataEdition();
  const userId = useDataUserId();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.store(edition, userId, "lifeos-health");
  const enqueue = useSerializedMutations();

  const query = useQuery({
    queryKey,
    enabled: !!adapter,
    queryFn: async () => {
      if (!adapter) return createDefaultHealthState();
      const doc = await adapter.getStore("lifeos-health");
      return doc ? doc.state : createDefaultHealthState();
    },
  });

  const mutation = useMutation({
    mutationFn: async (updater: (state: ReturnType<typeof createDefaultHealthState>) => ReturnType<typeof createDefaultHealthState>) => {
      if (!adapter) {
        throw new Error("No active data adapter available for Health mutation.");
      }
      return enqueue(async () => {
        const doc = await adapter.mutateStore("lifeos-health", (current) => {
          return updater(current || createDefaultHealthState());
        });
        return doc.state;
      });
    },
    onSuccess: (newState) => {
      queryClient.setQueryData(queryKey, newState);
    },
  });

  const days = query.data?.days ?? {};
  const workouts = query.data?.workouts ?? [];
  const customSports = query.data?.customSports ?? ["Gym", "Calisthenics", "Running", "Swimming", "Martial arts"];
  const exercises = query.data?.exercises ?? [];
  const programs = query.data?.programs ?? [];
  const goals = query.data?.goals ?? { steps: 8000, waterCups: 8, sleepH: 8, sessionsPerWeek: 3 };
  const activeWorkout = query.data?.activeWorkout ?? null;

  const day = (date: string = todayISO()): HealthDay => {
    return days[date] ?? { steps: 0, sleepH: 0, waterCups: 0 };
  };

  const patchDay = async (patch: Partial<HealthDay>, date: string = todayISO()): Promise<void> => {
    await mutation.mutateAsync((current) => patchDayOperation(current, patch, date));
  };

  const addWorkout = async (w: Omit<Workout, "id"> & { id?: string }): Promise<Workout> => {
    const newWorkout: Workout = {
      ...w,
      id: w.id || crypto.randomUUID(),
    };
    await mutation.mutateAsync((current) => addWorkoutOperation(current, newWorkout));
    return newWorkout;
  };

  const deleteWorkout = async (id: string): Promise<void> => {
    let targetWorkout = workouts.find((w) => w.id === id);
    if (!targetWorkout && adapter) {
      const doc = await adapter.getStore("lifeos-health");
      const docState = normalizeHealthState(doc?.state);
      targetWorkout = docState.workouts.find((w) => w.id === id);
    }
    if (targetWorkout && adapter) {
      await deleteEntityWithTrash(adapter, {
        itemType: "workout",
        entity: targetWorkout,
        title: targetWorkout.note || `${targetWorkout.sport} Workout`,
        originalStoreKey: "lifeos-health",
        deleteFromSource: async () => {
          await mutation.mutateAsync((current) => deleteWorkoutOperation(current, id));
        },
      });
    } else {
      await mutation.mutateAsync((current) => deleteWorkoutOperation(current, id));
    }
  };

  const addExercise = async (ex: Omit<Exercise, "id" | "isCustom">): Promise<Exercise> => {
    const created: Exercise = {
      ...ex,
      id: `ex-custom-${crypto.randomUUID()}`,
      isCustom: true,
    };
    await mutation.mutateAsync((current) => addExerciseOperation(current, created));
    return created;
  };

  const addProgram = async (prog: Omit<WorkoutProgram, "id"> & { id?: string }): Promise<WorkoutProgram> => {
    const newProg: WorkoutProgram = {
      ...prog,
      id: prog.id || crypto.randomUUID(),
    };
    await mutation.mutateAsync((current) => addProgramOperation(current, newProg));
    return newProg;
  };

  const updateProgram = async (id: string, patch: Partial<WorkoutProgram>): Promise<void> => {
    await mutation.mutateAsync((current) => updateProgramOperation(current, id, patch));
  };

  const deleteProgram = async (id: string): Promise<void> => {
    let targetProgram = programs.find((p) => p.id === id);
    if (!targetProgram && adapter) {
      const doc = await adapter.getStore("lifeos-health");
      const docState = normalizeHealthState(doc?.state);
      targetProgram = docState.programs.find((p) => p.id === id);
    }
    if (targetProgram && adapter) {
      await deleteEntityWithTrash(adapter, {
        itemType: "program",
        entity: targetProgram,
        title: targetProgram.name || "Workout Program",
        originalStoreKey: "lifeos-health",
        deleteFromSource: async () => {
          await mutation.mutateAsync((current) => deleteProgramOperation(current, id));
        },
      });
    } else {
      await mutation.mutateAsync((current) => deleteProgramOperation(current, id));
    }
  };

  const setActiveProgram = async (id: string): Promise<void> => {
    await mutation.mutateAsync((current) => setActiveProgramOperation(current, id));
  };

  const startActiveWorkout = async (session?: ProgramSession, sportOverride?: string): Promise<ActiveWorkout> => {
    const sport = session?.sport || sportOverride || "Gym";
    const sessionTitle = session?.name || `${sport} Session`;
    const now = Date.now();

    let initialExercises: LoggedExercise[] = [];
    if (session && session.exercises && session.exercises.length > 0) {
      initialExercises = session.exercises.map((pEx) => {
        const exObj = exercises.find((e) => e.id === pEx.exerciseId || e.name === pEx.exerciseName);
        const mode = getExerciseTrackingMode(pEx.exerciseName, exObj?.category, exObj?.equipment);
        const targetSets =
          Array.isArray(pEx.targetSets) && pEx.targetSets.length > 0
            ? pEx.targetSets
            : Array.from({ length: 3 }, () => ({
                type: "N" as const,
                weightKg: 0,
                reps: mode === "bodyweight" ? 12 : 8,
              }));

        return {
          exerciseId: pEx.exerciseId || `ex-${crypto.randomUUID()}`,
          exerciseName: pEx.exerciseName || "Exercise",
          trackingMode: mode,
          notes: pEx.notes,
          sets: targetSets.map((tSet: TargetSet) => ({
            id: crypto.randomUUID(),
            type: tSet.type || "N",
            weightKg: tSet.weightKg || 0,
            reps: tSet.reps || (mode === "bodyweight" ? 12 : 8),
            durationSec: mode === "hold" || mode === "cardio_set" ? (tSet.durationSec || 30) : undefined,
            distanceMeters: mode === "cardio_set" ? (tSet.distanceMeters || 400) : undefined,
            completed: false,
          })),
        };
      });
    } else if (sport === "Gym") {
      initialExercises = [
        {
          exerciseId: "ex-bench-press",
          exerciseName: "Barbell Bench Press",
          trackingMode: "weight_reps",
          sets: [
            { id: crypto.randomUUID(), type: "W", weightKg: 40, reps: 10, completed: false },
            { id: crypto.randomUUID(), type: "N", weightKg: 70, reps: 8, completed: false },
            { id: crypto.randomUUID(), type: "N", weightKg: 70, reps: 8, completed: false },
          ],
        },
      ];
    } else if (sport === "Calisthenics") {
      initialExercises = [
        {
          exerciseId: "ex-pushups",
          exerciseName: "Push-ups",
          trackingMode: "bodyweight",
          sets: [
            { id: crypto.randomUUID(), type: "N", weightKg: 0, reps: 20, completed: false },
            { id: crypto.randomUUID(), type: "N", weightKg: 0, reps: 18, completed: false },
          ],
        },
      ];
    }

    const newActiveWorkout: ActiveWorkout = {
      id: crypto.randomUUID(),
      sessionId: session?.id,
      sessionTitle,
      sport,
      startTime: now,
      elapsedSec: 0,
      isPaused: false,
      lastTickAt: now,
      restTimerSec: null,
      restTimerTarget: null,
      loggedExercises: initialExercises,
      sportMetrics: {},
      notes: "",
      isMinimized: false,
    };

    await mutation.mutateAsync((current) => startActiveWorkoutOperation(current, newActiveWorkout));
    return newActiveWorkout;
  };

  const updateActiveWorkout = async (
    patchOrUpdater:
      | Partial<ActiveWorkout>
      | ((prev: ActiveWorkout) => Partial<ActiveWorkout>),
  ): Promise<void> => {
    await mutation.mutateAsync((current) =>
      updateActiveWorkoutOperation(current, patchOrUpdater),
    );
  };

  const pauseActiveWorkout = async (): Promise<void> => {
    await mutation.mutateAsync((current) => pauseActiveWorkoutOperation(current));
  };

  const resumeActiveWorkout = async (): Promise<void> => {
    await mutation.mutateAsync((current) => resumeActiveWorkoutOperation(current));
  };

  const tickActiveWorkout = async (): Promise<void> => {
    await mutation.mutateAsync((current) => tickActiveWorkoutOperation(current));
  };

  const setRestTimer = async (seconds: number | null): Promise<void> => {
    await mutation.mutateAsync((current) => setRestTimerOperation(current, seconds));
  };

  const minimizeActiveWorkout = async (): Promise<void> => {
    await mutation.mutateAsync((current) => minimizeActiveWorkoutOperation(current));
  };

  const expandActiveWorkout = async (): Promise<void> => {
    await mutation.mutateAsync((current) => expandActiveWorkoutOperation(current));
  };

  const updateLoggedExercise = async (
    exerciseIndex: number,
    updater: (ex: LoggedExercise) => LoggedExercise,
  ): Promise<void> => {
    await mutation.mutateAsync((current) => updateLoggedExerciseOperation(current, exerciseIndex, updater));
  };

  const updateLoggedSet = async (
    exerciseIndex: number,
    setIndex: number,
    patch: Partial<LoggedSet>,
  ): Promise<void> => {
    await mutation.mutateAsync((current) => updateLoggedSetOperation(current, exerciseIndex, setIndex, patch));
  };

  const addSetToLoggedExercise = async (exerciseIndex: number): Promise<void> => {
    const newSet: LoggedSet = {
      id: crypto.randomUUID(),
      type: "N",
      weightKg: 0,
      reps: 8,
      completed: false,
    };
    await mutation.mutateAsync((current) => addSetToLoggedExerciseOperation(current, exerciseIndex, newSet));
  };

  const removeSetFromLoggedExercise = async (exerciseIndex: number, setIndex: number): Promise<void> => {
    await mutation.mutateAsync((current) => removeSetFromLoggedExerciseOperation(current, exerciseIndex, setIndex));
  };

  const addExerciseToActiveWorkout = async (exercise: Exercise): Promise<void> => {
    const mode = getExerciseTrackingMode(exercise.name, exercise.category, exercise.equipment);
    const newExercise: LoggedExercise = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      trackingMode: mode,
      sets: [
        {
          id: crypto.randomUUID(),
          type: "N",
          weightKg: 0,
          reps: mode === "bodyweight" ? 12 : 8,
          completed: false,
        },
      ],
    };
    await mutation.mutateAsync((current) => addExerciseToActiveWorkoutOperation(current, newExercise));
  };

  const removeExerciseFromActiveWorkout = async (exerciseIndex: number): Promise<void> => {
    await mutation.mutateAsync((current) => removeExerciseFromActiveWorkoutOperation(current, exerciseIndex));
  };

  const reorderLoggedExercises = async (newOrder: LoggedExercise[]): Promise<void> => {
    await mutation.mutateAsync((current) => reorderLoggedExercisesOperation(current, newOrder));
  };

  const updateActiveWorkoutNotes = async (notes: string): Promise<void> => {
    await mutation.mutateAsync((current) => updateActiveWorkoutNotesOperation(current, notes));
  };

  const updateActiveSportMetrics = async (metrics: Record<string, unknown>): Promise<void> => {
    await mutation.mutateAsync((current) => updateActiveSportMetricsOperation(current, metrics));
  };

  const cancelActiveWorkout = async (): Promise<void> => {
    await mutation.mutateAsync((current) => cancelActiveWorkoutOperation(current));
  };

  const finishActiveWorkout = async (): Promise<{ workout: Workout; newPRs: string[] }> => {
    if (!activeWorkout) {
      throw new Error("No active workout to finish.");
    }
    const { elapsedSec } = getDisplayedWorkoutSeconds(activeWorkout);
    const minutes = Math.max(1, Math.round(elapsedSec / 60));

    // Pre-calculate PRs and metrics
    const newPRsEarned: string[] = [];
    const newWorkout: Workout = {
      id: crypto.randomUUID(),
      date: todayISO(),
      sport: activeWorkout.sport,
      minutes,
      intensity: "moderate",
      note: activeWorkout.notes,
      detailedExercises: activeWorkout.loggedExercises,
      sportMetrics: activeWorkout.sportMetrics,
      programId: activeWorkout.sessionId,
      prsEarned: newPRsEarned,
    };

    await mutation.mutateAsync((current) => finishActiveWorkoutOperation(current, newWorkout));
    return { workout: newWorkout, newPRs: newPRsEarned };
  };

  const restoreDefaultPrograms = async (): Promise<void> => {
    if (!adapter) return;
    await restoreDefaultProgramsService(adapter);
    await queryClient.invalidateQueries();
  };

  return {
    days,
    workouts,
    customSports,
    exercises,
    programs,
    goals,
    activeWorkout,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isMutating: mutation.isPending,
    day,
    patchDay,
    addWorkout,
    deleteWorkout,
    addExercise,
    addProgram,
    updateProgram,
    deleteProgram,
    restoreDefaultPrograms,
    setActiveProgram,
    startActiveWorkout,
    updateActiveWorkout,
    pauseActiveWorkout,
    resumeActiveWorkout,
    tickActiveWorkout,
    setRestTimer,
    minimizeActiveWorkout,
    expandActiveWorkout,
    updateLoggedExercise,
    updateLoggedSet,
    addSetToLoggedExercise,
    removeSetFromLoggedExercise,
    addExerciseToActiveWorkout,
    removeExerciseFromActiveWorkout,
    reorderLoggedExercises,
    updateActiveWorkoutNotes,
    updateActiveSportMetrics,
    cancelActiveWorkout,
    discardActiveWorkout: cancelActiveWorkout,
    finishActiveWorkout,
    refetch: query.refetch,
  };
}
