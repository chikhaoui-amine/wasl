"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Clock,
  Plus,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Trash2,
  Trophy,
  X,
  Dumbbell,
  Footprints,
  Droplet,
  Flame,
  Activity,
  ChevronRight,
  Minimize2,
  Maximize2,
  Timer,
  Calculator,
  FlameKindling,
  SlidersHorizontal,
} from "lucide-react";
import {
  useHealthData,
  getExerciseTrackingMode,
  getDisplayedWorkoutSeconds,
  formatSetSummary,
  type TrackingMode,
  type ProgramSession,
  type LoggedSet,
  type Exercise,
} from "@/lib/data/domains/health";
import { ExerciseLibraryModal } from "./ExerciseLibraryModal";
import { workoutAudio } from "@/lib/audio/workout-audio";
import { cn } from "@/lib/utils";

export { getExerciseTrackingMode, type TrackingMode };

interface WorkoutLoggerModalProps {
  open?: boolean;
  session?: ProgramSession;
  sportOverride?: string;
  onClose?: () => void;
}

export function WorkoutLoggerModal({ open: propsOpen, session, sportOverride, onClose }: WorkoutLoggerModalProps) {
  const {
    workouts,
    activeWorkout,
    startActiveWorkout,
    updateActiveWorkout,
    pauseActiveWorkout,
    resumeActiveWorkout,
    setRestTimer,
    minimizeActiveWorkout,
    discardActiveWorkout,
    finishActiveWorkout,
  } = useHealthData();

  const [now, setNow] = useState(() => Date.now());

  // If props open is passed and activeWorkout is null, start a new active workout
  useEffect(() => {
    if (propsOpen && !activeWorkout) {
      startActiveWorkout(session, sportOverride);
    }
  }, [propsOpen, activeWorkout, session, sportOverride, startActiveWorkout]);

  // Modal open condition
  const isOpen = activeWorkout !== null && !activeWorkout.isMinimized;

  // Active workout in-memory live clock & rest timer chime
  useEffect(() => {
    if (!activeWorkout) return;

    const interval = setInterval(() => {
      const currentNow = Date.now();
      setNow(currentNow);

      if (activeWorkout.restTimerTarget) {
        const rem = Math.ceil((activeWorkout.restTimerTarget - currentNow) / 1000);
        if (rem === 1) {
          workoutAudio.playRestTimerComplete();
          workoutAudio.vibrate([100, 50, 100]);
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [activeWorkout]);

  const { elapsedSec, restTimerSec } = getDisplayedWorkoutSeconds(activeWorkout, now);

  // Keyboard Escape listener -> minimizes safely
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        minimizeActiveWorkout();
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, minimizeActiveWorkout, onClose]);

  // Modals state
  const [pickingExercise, setPickingExercise] = useState(false);
  const [replaceIdx, setReplaceIdx] = useState<number | null>(null);
  const [prsEarnedSummary, setPrsEarnedSummary] = useState<string[] | null>(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [plateCalcTargetWeight, setPlateCalcTargetWeight] = useState<number | null>(null);
  const [barWeight, setBarWeight] = useState<number>(20);
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!activeWorkout || activeWorkout.isMinimized) {
    // If PRs summary is active even after workout finished, show celebration
    if (prsEarnedSummary) {
      return (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
          <div className="w-full max-w-md card-glass rounded-2xl p-6 text-center space-y-4 shadow-float">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-warn/20 text-warn animate-bounce">
              <Trophy className="h-9 w-9" />
            </div>
            <div>
              <h3 className="font-display text-2xl font-bold text-text">New Personal Records!</h3>
              <p className="text-xs text-muted mt-1">You shattered previous personal bests in this session!</p>
            </div>
            <div className="space-y-2 rounded-xl bg-surface-2 p-3.5 text-left">
              {prsEarnedSummary.map((pr, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs font-bold text-accent">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span>{pr}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setPrsEarnedSummary(null);
                onClose?.();
              }}
              className="w-full btn-hero rounded-xl py-3 text-sm font-bold shadow-md"
            >
              Awesome! Done
            </button>
          </div>
        </div>
      );
    }
    return null;
  }

  const fmtTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Previous performance lookup
  const getPrevSetInfo = (exerciseName: string, mode: TrackingMode) => {
    for (const w of workouts) {
      if (!w.detailedExercises) continue;
      const match = w.detailedExercises.find((ex) => ex.exerciseName === exerciseName);
      if (match && match.sets.length > 0) {
        const completedSets = match.sets.filter((s) => s.completed);
        if (completedSets.length > 0) {
          return completedSets
            .map((s) => formatSetSummary(s, mode, exerciseName))
            .slice(0, 3)
            .join(", ");
        }
      }
    }
    return null;
  };

  // Set toggle handler
  const handleToggleSetComplete = (exIdx: number, setIdx: number) => {
    const updated = [...activeWorkout.loggedExercises];
    const targetSet = updated[exIdx].sets[setIdx];
    const isNowCompleted = !targetSet.completed;
    targetSet.completed = isNowCompleted;

    updateActiveWorkout({ loggedExercises: updated });

    if (isNowCompleted) {
      workoutAudio.playSetComplete();
      workoutAudio.vibrate(50);
      // Auto trigger rest timer (90 sec default)
      const now = Date.now();
      const restSec = 90;
      updateActiveWorkout({
        restTimerSec: restSec,
        restTimerTarget: now + restSec * 1000,
      });
    }
  };

  const handleUpdateSet = (exIdx: number, setIdx: number, patch: Partial<LoggedSet>) => {
    const updated = [...activeWorkout.loggedExercises];
    updated[exIdx].sets[setIdx] = { ...updated[exIdx].sets[setIdx], ...patch };
    updateActiveWorkout({ loggedExercises: updated });
  };

  const handleChangeTrackingMode = (exIdx: number, mode: TrackingMode) => {
    const updated = [...activeWorkout.loggedExercises];
    updated[exIdx].trackingMode = mode;
    updateActiveWorkout({ loggedExercises: updated });
  };

  const handleAddSet = (exIdx: number) => {
    const updated = [...activeWorkout.loggedExercises];
    const ex = updated[exIdx];
    const mode = ex.trackingMode || getExerciseTrackingMode(ex.exerciseName);
    const lastSet = ex.sets.at(-1);

    updated[exIdx].sets.push({
      id: crypto.randomUUID(),
      type: "N",
      weightKg: lastSet?.weightKg ?? (mode === "bodyweight" ? 0 : 20),
      reps: lastSet?.reps ?? (mode === "bodyweight" ? 12 : 8),
      durationSec: mode === "hold" || mode === "cardio_set" ? (lastSet?.durationSec ?? 45) : undefined,
      distanceMeters: mode === "cardio_set" ? (lastSet?.distanceMeters ?? 400) : undefined,
      completed: false,
    });
    updateActiveWorkout({ loggedExercises: updated });
  };

  const handleDeleteSet = (exIdx: number, setIdx: number) => {
    const updated = [...activeWorkout.loggedExercises];
    if (updated[exIdx].sets.length <= 1) return;
    updated[exIdx].sets = updated[exIdx].sets.filter((_, idx) => idx !== setIdx);
    updateActiveWorkout({ loggedExercises: updated });
  };

  const makeDefaultSets = (mode: TrackingMode): LoggedSet[] => {
    if (mode === "hold") {
      return [
        { id: crypto.randomUUID(), type: "N", weightKg: 0, reps: 1, durationSec: 30, completed: false },
        { id: crypto.randomUUID(), type: "N", weightKg: 0, reps: 1, durationSec: 45, completed: false },
      ];
    }
    if (mode === "cardio_set") {
      return [
        { id: crypto.randomUUID(), type: "N", weightKg: 0, reps: 1, durationSec: 60, distanceMeters: 400, completed: false },
        { id: crypto.randomUUID(), type: "N", weightKg: 0, reps: 1, durationSec: 60, distanceMeters: 400, completed: false },
      ];
    }
    if (mode === "bodyweight") {
      return [
        { id: crypto.randomUUID(), type: "N", weightKg: 0, reps: 15, completed: false },
        { id: crypto.randomUUID(), type: "N", weightKg: 0, reps: 12, completed: false },
      ];
    }
    return [
      { id: crypto.randomUUID(), type: "W", weightKg: 20, reps: 10, completed: false },
      { id: crypto.randomUUID(), type: "N", weightKg: 40, reps: 8, completed: false },
    ];
  };

  const handleSelectExercise = (ex: Exercise) => {
    const defaultMode = getExerciseTrackingMode(ex.name, ex.category, ex.equipment);

    if (replaceIdx !== null) {
      const updated = [...activeWorkout.loggedExercises];
      updated[replaceIdx] = {
        exerciseId: ex.id,
        exerciseName: ex.name,
        trackingMode: defaultMode,
        sets: makeDefaultSets(defaultMode),
      };
      updateActiveWorkout({ loggedExercises: updated });
      setReplaceIdx(null);
    } else {
      updateActiveWorkout({
        loggedExercises: [
          ...activeWorkout.loggedExercises,
          {
            exerciseId: ex.id,
            exerciseName: ex.name,
            trackingMode: defaultMode,
            sets: makeDefaultSets(defaultMode),
          },
        ],
      });
    }
  };

  const handleFinish = async () => {
    const res = await finishActiveWorkout();
    if (res) {
      if (res.newPRs.length > 0) {
        setPrsEarnedSummary(res.newPRs);
      } else {
        onClose?.();
      }
    }
  };

  const handleQuickAddRest = (seconds: number) => {
    const curSec = activeWorkout?.restTimerSec || 0;
    setRestTimer(curSec + seconds);
  };

  // Compute live stats
  let totalSets = 0;
  let completedSets = 0;
  let totalVolumeKg = 0;
  (activeWorkout?.loggedExercises || []).forEach((ex) => {
    (ex.sets || []).forEach((s) => {
      totalSets++;
      if (s.completed) {
        completedSets++;
        if (s.weightKg && s.reps) {
          totalVolumeKg += s.weightKg * s.reps;
        }
      }
    });
  });

  const progressPercent = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

  // Plate Calculator calculation
  const calculatePlates = (targetWeight: number, bar: number) => {
    const availablePlates = [25, 20, 15, 10, 5, 2.5, 1.25];
    let remainingPerSide = Math.max(0, (targetWeight - bar) / 2);
    const result: { plate: number; count: number }[] = [];

    for (const plate of availablePlates) {
      if (remainingPerSide >= plate) {
        const count = Math.floor(remainingPerSide / plate);
        result.push({ plate, count });
        remainingPerSide = Number((remainingPerSide - count * plate).toFixed(2));
      }
    }
    return { plates: result, remaining: remainingPerSide };
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/75 backdrop-blur-xl transition-all p-2 sm:p-4 lg:p-6",
        isFullscreen && "p-0",
      )}
      onClick={() => {
        // Safe anti-dismissal: clicking outside minimizes to dock bar
        minimizeActiveWorkout();
        onClose?.();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative flex flex-col w-full card-glass rounded-2xl sm:rounded-3xl shadow-float border border-border/80 bg-surface-1/95 overflow-hidden transition-all",
          isFullscreen
            ? "h-dvh max-h-dvh w-dvw max-w-full rounded-none border-none"
            : "max-w-5xl xl:max-w-6xl max-h-[92vh] sm:max-h-[88vh]",
        )}
      >
        {/* TOP WORKOUT STUDIO HEADER */}
        <div className="border-b border-border px-3.5 py-2.5 sm:px-6 sm:py-4 bg-surface-2/70 shrink-0 space-y-2 sm:space-y-0">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="grid h-8.5 w-8.5 sm:h-11 sm:w-11 place-items-center rounded-xl bg-accent/20 text-accent font-bold shrink-0">
                <Dumbbell className="h-4.5 w-4.5 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h2 className="font-display text-sm sm:text-lg font-bold text-text truncate max-w-[140px] xs:max-w-[200px] sm:max-w-md">
                    {activeWorkout.sessionTitle}
                  </h2>
                  <span className="rounded-full bg-accent/20 border border-accent/40 px-2 py-0.5 text-[9.5px] sm:text-[10px] font-bold text-accent shrink-0">
                    {activeWorkout.sport}
                  </span>
                </div>
                <p className="text-[10.5px] sm:text-[11px] text-muted truncate">
                  {completedSets} of {totalSets} sets ({progressPercent}%)
                </p>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Desktop Live Stopwatch with Pause/Resume */}
              <div className="hidden sm:flex items-center gap-2 rounded-xl bg-surface-1 border border-border px-3 py-1.5 shadow-sm">
                <div className="flex items-center gap-1.5 font-mono text-sm sm:text-base font-bold text-text">
                  <Clock className="h-4 w-4 text-accent animate-pulse" />
                  <span>{fmtTimer(elapsedSec)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => (activeWorkout.isPaused ? resumeActiveWorkout() : pauseActiveWorkout())}
                  className="grid h-6 w-6 place-items-center rounded-md text-faint hover:text-text hover:bg-surface-hover"
                  title={activeWorkout.isPaused ? "Resume Timer" : "Pause Timer"}
                >
                  {activeWorkout.isPaused ? (
                    <Play className="h-3.5 w-3.5 text-emerald-400 fill-current" />
                  ) : (
                    <Pause className="h-3.5 w-3.5 text-accent" />
                  )}
                </button>
              </div>

              {/* Fullscreen (Desktop only) */}
              <button
                type="button"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="hidden md:grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface-1 text-faint hover:text-text hover:bg-surface-hover"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Workout Mode"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>

              {/* Minimize */}
              <button
                type="button"
                onClick={() => {
                  minimizeActiveWorkout();
                  onClose?.();
                }}
                className="flex items-center gap-1 rounded-lg sm:rounded-xl border border-border bg-surface-1 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-semibold text-muted hover:text-text hover:bg-surface-hover transition-colors"
                title="Minimize workout to bottom dock"
              >
                <Minimize2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Minimize</span>
              </button>

              {/* Discard */}
              <button
                type="button"
                onClick={() => setConfirmDiscardOpen(true)}
                className="grid h-7.5 w-7.5 sm:h-9 sm:w-9 place-items-center rounded-lg sm:rounded-xl text-faint hover:bg-danger/15 hover:text-danger transition-colors"
                title="Discard Workout"
              >
                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>

              {/* Desktop Big Finish CTA */}
              <button
                type="button"
                onClick={handleFinish}
                className="hidden sm:flex btn-hero items-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold shadow-md"
              >
                <Check className="h-4 w-4 stroke-[3]" />
                <span>Finish Session</span>
              </button>
            </div>
          </div>

          {/* Mobile Second Row: Live Timer + Mobile Finish CTA */}
          <div className="flex sm:hidden items-center justify-between gap-2 pt-1.5 border-t border-border/40">
            <div className="flex items-center gap-2 rounded-lg bg-surface-1 border border-border px-2.5 py-1 shadow-xs">
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-text">
                <Clock className="h-3.5 w-3.5 text-accent animate-pulse" />
                <span>{fmtTimer(elapsedSec)}</span>
              </div>
              <button
                type="button"
                onClick={() => (activeWorkout.isPaused ? resumeActiveWorkout() : pauseActiveWorkout())}
                className="grid h-5 w-5 place-items-center rounded text-faint hover:text-text hover:bg-surface-hover"
              >
                {activeWorkout.isPaused ? (
                  <Play className="h-3 w-3 text-emerald-400 fill-current" />
                ) : (
                  <Pause className="h-3 w-3 text-accent" />
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={handleFinish}
              className="btn-hero flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold shadow-sm"
            >
              <Check className="h-3.5 w-3.5 stroke-[3]" />
              <span>Finish Session</span>
            </button>
          </div>
        </div>

        {/* MAIN STUDIO DUAL-PANE BODY */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-6">
          {/* LEFT PANE: EXERCISES LIST & SET LOGGING (7/12 cols on desktop) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted">
                Exercises & Sets ({activeWorkout.loggedExercises.length})
              </h3>
              <button
                type="button"
                onClick={() => {
                  setReplaceIdx(null);
                  setPickingExercise(true);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-accent/15 border border-accent/30 px-3 py-1 text-xs font-bold text-accent hover:bg-accent hover:text-accent-fg transition-all"
              >
                <Plus className="h-3.5 w-3.5" /> Add Exercise
              </button>
            </div>

            {activeWorkout.loggedExercises.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center space-y-3 bg-surface-2/40">
                <Dumbbell className="mx-auto h-8 w-8 text-faint" />
                <div>
                  <p className="font-bold text-sm text-text">No exercises added yet</p>
                  <p className="text-xs text-muted mt-0.5">
                    Add custom exercise sets to log weights & reps, or record overall sport metrics.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReplaceIdx(null);
                    setPickingExercise(true);
                  }}
                  className="btn-hero inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold"
                >
                  <Plus className="h-4 w-4" /> Add Exercise to Workout
                </button>
              </div>
            ) : (
              activeWorkout.loggedExercises.map((ex, exIdx) => {
                const mode = ex.trackingMode || getExerciseTrackingMode(ex.exerciseName);
                const prevSetText = getPrevSetInfo(ex.exerciseName, mode);

                return (
                  <div
                    key={exIdx}
                    className="rounded-2xl border border-border bg-surface-2/80 p-4 sm:p-5 space-y-3.5 shadow-sm hover:border-border-strong transition-all"
                  >
                    {/* Exercise Card Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="grid h-6 w-6 place-items-center rounded-md bg-surface-3 text-[11px] font-mono font-bold text-muted">
                            {exIdx + 1}
                          </span>
                          <h4 className="font-bold text-base text-text">{ex.exerciseName}</h4>
                        </div>
                        {prevSetText && (
                          <p className="text-[11px] font-medium text-accent mt-0.5 pl-8">
                            Previous Best: <span className="text-muted">{prevSetText}</span>
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        {/* Tracking Mode Pill */}
                        <select
                          value={mode}
                          onChange={(e) => handleChangeTrackingMode(exIdx, e.target.value as TrackingMode)}
                          className="rounded-lg bg-surface px-2.5 py-1 text-[11px] font-semibold border border-border text-muted"
                          title="Change set format"
                        >
                          <option value="weight_reps">Weight & Reps</option>
                          <option value="bodyweight">Bodyweight (Reps + Added Wt)</option>
                          <option value="hold">Hold Time (sec)</option>
                          <option value="cardio_set">Cardio Interval</option>
                        </select>

                        {/* Plate calculator trigger for barbell lifts */}
                        {mode === "weight_reps" && (
                          <button
                            type="button"
                            onClick={() => {
                              const lastWeight = ex.sets.find((s) => s.weightKg > 0)?.weightKg || 60;
                              setPlateCalcTargetWeight(lastWeight);
                            }}
                            className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-medium text-muted hover:text-accent hover:border-accent/40"
                            title="Open barbell plate calculator"
                          >
                            <Calculator className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Plates</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setReplaceIdx(exIdx);
                            setPickingExercise(true);
                          }}
                          className="text-faint hover:text-accent font-medium text-[11px]"
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateActiveWorkout({
                              loggedExercises: activeWorkout.loggedExercises.filter((_, idx) => idx !== exIdx),
                            })
                          }
                          className="text-faint hover:text-danger font-medium text-[11px]"
                        >
                          Skip
                        </button>
                      </div>
                    </div>

                    {/* DYNAMIC SETS TABLE */}
                    <div className="space-y-2">
                      {mode === "weight_reps" && (
                        <>
                          <div className="grid grid-cols-12 gap-1.5 sm:gap-2 text-[10px] font-bold uppercase text-faint px-1.5 sm:px-2">
                            <span className="col-span-2 sm:col-span-2">Set</span>
                            <span className="col-span-5 sm:col-span-4">Weight (kg)</span>
                            <span className="col-span-3 sm:col-span-4">Reps</span>
                            <span className="col-span-2 text-center">Done</span>
                          </div>

                          {ex.sets.map((st, setIdx) => (
                            <div
                              key={st.id}
                              className={cn(
                                "grid grid-cols-12 gap-1.5 sm:gap-2 items-center text-xs p-1.5 sm:p-2 rounded-xl transition-all",
                                st.completed
                                  ? "bg-emerald-500/15 border border-emerald-500/40 shadow-sm"
                                  : "bg-surface-1 border border-border/60",
                              )}
                            >
                              {/* Set Index + Type Pill */}
                              <div className="col-span-2 sm:col-span-2 flex items-center gap-1 sm:gap-1.5">
                                <span className="font-mono font-bold text-muted text-xs sm:text-[13px]">#{setIdx + 1}</span>
                                <select
                                  value={st.type || "N"}
                                  onChange={(e) =>
                                    handleUpdateSet(exIdx, setIdx, { type: e.target.value as "W" | "N" | "D" | "F" })
                                  }
                                  className="hidden sm:inline-block rounded bg-surface-2 px-1 py-0.5 text-[10px] font-bold text-muted border border-border/80"
                                  title="Set Type: Warmup, Normal, Drop, Failure"
                                >
                                  <option value="N">Normal</option>
                                  <option value="W">Warmup</option>
                                  <option value="D">Drop</option>
                                  <option value="F">Failure</option>
                                </select>
                              </div>

                              {/* Weight Input with Stepper */}
                              <div className="col-span-5 sm:col-span-4 flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateSet(exIdx, setIdx, {
                                      weightKg: Math.max(0, (st.weightKg || 0) - 2.5),
                                    })
                                  }
                                  className="hidden sm:grid h-7 w-6 place-items-center rounded bg-surface-2 text-faint hover:text-text text-[11px]"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={st.weightKg !== undefined && st.weightKg !== 0 ? st.weightKg : ""}
                                  onChange={(e) =>
                                    handleUpdateSet(exIdx, setIdx, { weightKg: Number(e.target.value) })
                                  }
                                  placeholder="0"
                                  className="w-full rounded-lg bg-surface px-1.5 sm:px-2 py-1 sm:py-1.5 text-center font-bold text-xs sm:text-sm text-text border border-border outline-none focus:border-accent"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateSet(exIdx, setIdx, {
                                      weightKg: (st.weightKg || 0) + 2.5,
                                    })
                                  }
                                  className="hidden sm:grid h-7 w-6 place-items-center rounded bg-surface-2 text-faint hover:text-text text-[11px]"
                                >
                                  +
                                </button>
                              </div>

                              {/* Reps Input with Stepper */}
                              <div className="col-span-3 sm:col-span-4 flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateSet(exIdx, setIdx, {
                                      reps: Math.max(0, (st.reps || 0) - 1),
                                    })
                                  }
                                  className="hidden sm:grid h-7 w-6 place-items-center rounded bg-surface-2 text-faint hover:text-text text-[11px]"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  value={st.reps || ""}
                                  onChange={(e) =>
                                    handleUpdateSet(exIdx, setIdx, { reps: Number(e.target.value) })
                                  }
                                  placeholder="8"
                                  className="w-full rounded-lg bg-surface px-1.5 sm:px-2 py-1 sm:py-1.5 text-center font-bold text-xs sm:text-sm text-text border border-border outline-none focus:border-accent"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateSet(exIdx, setIdx, {
                                      reps: (st.reps || 0) + 1,
                                    })
                                  }
                                  className="hidden sm:grid h-7 w-6 place-items-center rounded bg-surface-2 text-faint hover:text-text text-[11px]"
                                >
                                  +
                                </button>
                              </div>

                              {/* Done Checkbox + Delete */}
                              <div className="col-span-2 flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSetComplete(exIdx, setIdx)}
                                  className={cn(
                                    "grid h-7.5 w-7.5 sm:h-9 sm:w-9 place-items-center rounded-lg sm:rounded-xl border-2 transition-all shadow-sm",
                                    st.completed
                                      ? "bg-emerald-500 border-emerald-500 text-black font-bold scale-105"
                                      : "border-border text-transparent bg-surface hover:border-accent hover:text-faint",
                                  )}
                                  title="Mark set as completed"
                                >
                                  <Check className="h-3.5 w-3.5 sm:h-5 sm:w-5 stroke-[3]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSet(exIdx, setIdx)}
                                  className="text-faint hover:text-danger p-0.5 sm:p-1"
                                  title="Delete set"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </>
                      )}

                      {mode === "bodyweight" && (
                        <>
                          <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase text-faint px-2">
                            <span className="col-span-2">Set</span>
                            <span className="col-span-5 sm:col-span-4">Reps</span>
                            <span className="col-span-3 sm:col-span-4">Added Wt (+kg)</span>
                            <span className="col-span-2 text-center">Done</span>
                          </div>

                          {ex.sets.map((st, setIdx) => (
                            <div
                              key={st.id}
                              className={cn(
                                "grid grid-cols-12 gap-2 items-center text-xs p-2 rounded-xl transition-all",
                                st.completed
                                  ? "bg-emerald-500/15 border border-emerald-500/40 shadow-sm"
                                  : "bg-surface-1 border border-border/60",
                              )}
                            >
                              <div className="col-span-2 flex items-center gap-1.5">
                                <span className="font-mono font-bold text-muted text-[13px]">#{setIdx + 1}</span>
                              </div>

                              <div className="col-span-5 sm:col-span-4">
                                <input
                                  type="number"
                                  value={st.reps || ""}
                                  onChange={(e) =>
                                    handleUpdateSet(exIdx, setIdx, { reps: Number(e.target.value) })
                                  }
                                  placeholder="15"
                                  className="w-full rounded-lg bg-surface px-2 py-1.5 text-center font-bold text-sm text-text border border-border"
                                />
                              </div>

                              <div className="col-span-3 sm:col-span-4">
                                <input
                                  type="number"
                                  step="0.5"
                                  value={st.weightKg !== undefined && st.weightKg !== 0 ? st.weightKg : ""}
                                  onChange={(e) =>
                                    handleUpdateSet(exIdx, setIdx, { weightKg: Number(e.target.value) })
                                  }
                                  placeholder="+0"
                                  className="w-full rounded-lg bg-surface px-2 py-1.5 text-center font-bold text-sm text-text border border-border"
                                />
                              </div>

                              <div className="col-span-2 flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSetComplete(exIdx, setIdx)}
                                  className={cn(
                                    "grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-xl border-2 transition-all shadow-sm",
                                    st.completed
                                      ? "bg-emerald-500 border-emerald-500 text-black font-bold scale-105"
                                      : "border-border text-transparent bg-surface hover:border-accent",
                                  )}
                                >
                                  <Check className="h-4 w-4 stroke-[3]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSet(exIdx, setIdx)}
                                  className="text-faint hover:text-danger p-1"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </>
                      )}

                      {mode === "hold" && (
                        <>
                          <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase text-faint px-2">
                            <span className="col-span-2">Set</span>
                            <span className="col-span-5 sm:col-span-4">Hold Time (sec)</span>
                            <span className="col-span-3 sm:col-span-4">Added Wt (+kg)</span>
                            <span className="col-span-2 text-center">Done</span>
                          </div>

                          {ex.sets.map((st, setIdx) => (
                            <div
                              key={st.id}
                              className={cn(
                                "grid grid-cols-12 gap-2 items-center text-xs p-2 rounded-xl transition-all",
                                st.completed
                                  ? "bg-emerald-500/15 border border-emerald-500/40 shadow-sm"
                                  : "bg-surface-1 border border-border/60",
                              )}
                            >
                              <div className="col-span-2 flex items-center gap-1.5">
                                <span className="font-mono font-bold text-muted text-[13px]">#{setIdx + 1}</span>
                              </div>

                              <div className="col-span-5 sm:col-span-4">
                                <input
                                  type="number"
                                  value={st.durationSec || ""}
                                  onChange={(e) =>
                                    handleUpdateSet(exIdx, setIdx, { durationSec: Number(e.target.value) })
                                  }
                                  placeholder="45s"
                                  className="w-full rounded-lg bg-surface px-2 py-1.5 text-center font-bold text-sm text-amber-400 border border-border"
                                />
                              </div>

                              <div className="col-span-3 sm:col-span-4">
                                <input
                                  type="number"
                                  value={st.weightKg !== undefined && st.weightKg !== 0 ? st.weightKg : ""}
                                  onChange={(e) =>
                                    handleUpdateSet(exIdx, setIdx, { weightKg: Number(e.target.value) })
                                  }
                                  placeholder="+0"
                                  className="w-full rounded-lg bg-surface px-2 py-1.5 text-center font-bold text-sm text-text border border-border"
                                />
                              </div>

                              <div className="col-span-2 flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSetComplete(exIdx, setIdx)}
                                  className={cn(
                                    "grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-xl border-2 transition-all shadow-sm",
                                    st.completed
                                      ? "bg-emerald-500 border-emerald-500 text-black font-bold scale-105"
                                      : "border-border text-transparent bg-surface hover:border-accent",
                                  )}
                                >
                                  <Check className="h-4 w-4 stroke-[3]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSet(exIdx, setIdx)}
                                  className="text-faint hover:text-danger p-1"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </>
                      )}

                      {mode === "cardio_set" && (
                        <>
                          <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase text-faint px-2">
                            <span className="col-span-2">Set</span>
                            <span className="col-span-5 sm:col-span-4">Distance (m)</span>
                            <span className="col-span-3 sm:col-span-4">Time (sec)</span>
                            <span className="col-span-2 text-center">Done</span>
                          </div>

                          {ex.sets.map((st, setIdx) => (
                            <div
                              key={st.id}
                              className={cn(
                                "grid grid-cols-12 gap-2 items-center text-xs p-2 rounded-xl transition-all",
                                st.completed
                                  ? "bg-emerald-500/15 border border-emerald-500/40 shadow-sm"
                                  : "bg-surface-1 border border-border/60",
                              )}
                            >
                              <div className="col-span-2 flex items-center gap-1.5">
                                <span className="font-mono font-bold text-muted text-[13px]">#{setIdx + 1}</span>
                              </div>

                              <div className="col-span-5 sm:col-span-4">
                                <input
                                  type="number"
                                  value={st.distanceMeters || ""}
                                  onChange={(e) =>
                                    handleUpdateSet(exIdx, setIdx, { distanceMeters: Number(e.target.value) })
                                  }
                                  placeholder="400m"
                                  className="w-full rounded-lg bg-surface px-2 py-1.5 text-center font-bold text-sm text-cyan-400 border border-border"
                                />
                              </div>

                              <div className="col-span-3 sm:col-span-4">
                                <input
                                  type="number"
                                  value={st.durationSec || ""}
                                  onChange={(e) =>
                                    handleUpdateSet(exIdx, setIdx, { durationSec: Number(e.target.value) })
                                  }
                                  placeholder="60s"
                                  className="w-full rounded-lg bg-surface px-2 py-1.5 text-center font-bold text-sm text-text border border-border"
                                />
                              </div>

                              <div className="col-span-2 flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSetComplete(exIdx, setIdx)}
                                  className={cn(
                                    "grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-xl border-2 transition-all shadow-sm",
                                    st.completed
                                      ? "bg-emerald-500 border-emerald-500 text-black font-bold scale-105"
                                      : "border-border text-transparent bg-surface hover:border-accent",
                                  )}
                                >
                                  <Check className="h-4 w-4 stroke-[3]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSet(exIdx, setIdx)}
                                  className="text-faint hover:text-danger p-1"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>

                    {/* Add Set Action */}
                    <button
                      type="button"
                      onClick={() => handleAddSet(exIdx)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold text-accent hover:bg-accent/15 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Next Set
                    </button>
                  </div>
                );
              })
            )}

            <button
              type="button"
              onClick={() => {
                setReplaceIdx(null);
                setPickingExercise(true);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/80 py-4 text-xs font-bold text-accent hover:bg-surface-hover hover:border-accent/60 transition-all"
            >
              <Plus className="h-4 w-4" /> Add Exercise to Session
            </button>
          </div>

          {/* RIGHT PANE: LIVE DASHBOARD, REST TIMER & SPORT TARGETS (5/12 cols on desktop) */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            {/* REST TIMER HUB */}
            <div className="rounded-2xl border border-border bg-surface-2/90 p-4 sm:p-5 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-display text-sm font-bold text-text">
                  <Timer className="h-4 w-4 text-amber-400" />
                  <span>Rest Timer</span>
                </div>
                {activeWorkout.restTimerSec !== null && activeWorkout.restTimerSec > 0 && (
                  <button
                    type="button"
                    onClick={() => setRestTimer(null)}
                    className="text-[11px] font-semibold text-faint hover:text-danger"
                  >
                    Skip Rest
                  </button>
                )}
              </div>

              {/* Big Rest Countdown display */}
              <div className="flex flex-col items-center justify-center rounded-xl bg-surface-1 p-4 border border-border/60">
                {restTimerSec !== null && restTimerSec > 0 ? (
                  <div className="text-center space-y-1">
                    <span className="font-mono text-3xl sm:text-4xl font-black text-amber-400 animate-pulse">
                      {fmtTimer(restTimerSec)}
                    </span>
                    <p className="text-[11px] font-medium text-muted">Rest & recover before next set</p>
                  </div>
                ) : (
                  <div className="text-center space-y-1">
                    <span className="font-mono text-2xl font-bold text-faint">00:00</span>
                    <p className="text-[11px] text-faint">Rest timer ready</p>
                  </div>
                )}

                {/* Quick Add Rest Presets */}
                <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
                  {[15, 30, 60, 90, 120].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => handleQuickAddRest(sec)}
                      className="rounded-lg bg-surface-2 border border-border px-2.5 py-1 text-[11px] font-bold text-muted hover:border-accent/40 hover:text-accent transition-all"
                    >
                      +{sec}s
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* LIVE WORKOUT VOLUME & STATS */}
            <div className="rounded-2xl border border-border bg-surface-2/90 p-4 sm:p-5 space-y-3 shadow-sm">
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-muted">
                Live Workout Stats
              </h4>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-surface-1 p-3 border border-border/60">
                  <span className="text-[10px] font-bold uppercase text-faint">Volume Lifted</span>
                  <div className="mt-1 font-display text-xl font-bold text-accent">
                    {totalVolumeKg > 0 ? `${totalVolumeKg.toLocaleString()} kg` : "—"}
                  </div>
                </div>

                <div className="rounded-xl bg-surface-1 p-3 border border-border/60">
                  <span className="text-[10px] font-bold uppercase text-faint">Sets Completed</span>
                  <div className="mt-1 font-display text-xl font-bold text-text">
                    {completedSets} <span className="text-xs font-normal text-faint">/ {totalSets}</span>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-muted">
                  <span>Session Completion</span>
                  <span className="text-accent font-bold">{progressPercent}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-1 border border-border">
                  <div
                    className="h-full bg-accent transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* DYNAMIC SPORT METRICS */}
            <div className="rounded-2xl border border-border bg-surface-2/90 p-4 sm:p-5 space-y-3 shadow-sm">
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-muted">
                Sport Metrics & Targets
              </h4>

              {activeWorkout.sport === "Running" && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-muted block mb-1">Distance (km)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={activeWorkout.sportMetrics?.distanceKm || ""}
                      onChange={(e) =>
                        updateActiveWorkout((prev) => ({
                          sportMetrics: { ...prev.sportMetrics, distanceKm: e.target.value ? Number(e.target.value) : "" },
                        }))
                      }
                      placeholder="5.0"
                      className="w-full rounded-lg bg-surface px-2.5 py-1.5 text-xs text-text border border-border"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted block mb-1">Avg HR (bpm)</label>
                    <input
                      type="number"
                      value={activeWorkout.sportMetrics?.avgHeartRate || ""}
                      onChange={(e) =>
                        updateActiveWorkout((prev) => ({
                          sportMetrics: { ...prev.sportMetrics, avgHeartRate: e.target.value ? Number(e.target.value) : "" },
                        }))
                      }
                      placeholder="150"
                      className="w-full rounded-lg bg-surface px-2.5 py-1.5 text-xs text-text border border-border"
                    />
                  </div>
                </div>
              )}

              {activeWorkout.sport === "Cycling" && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-muted block mb-1">Distance (km)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={activeWorkout.sportMetrics?.distanceKm || ""}
                      onChange={(e) =>
                        updateActiveWorkout((prev) => ({
                          sportMetrics: { ...prev.sportMetrics, distanceKm: e.target.value ? Number(e.target.value) : "" },
                        }))
                      }
                      placeholder="20.0"
                      className="w-full rounded-lg bg-surface px-2.5 py-1.5 text-xs text-text border border-border"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted block mb-1">Avg Power (W)</label>
                    <input
                      type="number"
                      value={activeWorkout.sportMetrics?.avgPowerWatts || ""}
                      onChange={(e) =>
                        updateActiveWorkout((prev) => ({
                          sportMetrics: { ...prev.sportMetrics, avgPowerWatts: e.target.value ? Number(e.target.value) : "" },
                        }))
                      }
                      placeholder="200"
                      className="w-full rounded-lg bg-surface px-2.5 py-1.5 text-xs text-text border border-border"
                    />
                  </div>
                </div>
              )}

              {activeWorkout.sport === "Gym" && (
                <div>
                  <label className="text-[10px] font-bold text-muted block mb-1">Session Focus</label>
                  <select
                    value={activeWorkout.sportMetrics?.focusArea || "Hypertrophy"}
                    onChange={(e) =>
                      updateActiveWorkout((prev) => ({
                        sportMetrics: { ...prev.sportMetrics, focusArea: e.target.value },
                      }))
                    }
                    className="w-full rounded-lg bg-surface px-2.5 py-1.5 text-xs text-text border border-border font-semibold"
                  >
                    <option value="Hypertrophy">Hypertrophy (Muscle Building)</option>
                    <option value="Strength">Strength & Power</option>
                    <option value="Powerlifting">Powerlifting</option>
                    <option value="Endurance">Muscular Endurance</option>
                    <option value="Full Body">Full Body</option>
                  </select>
                </div>
              )}

              {/* Calories & Notes */}
              <div className="space-y-2 pt-1 border-t border-border/60">
                <div>
                  <label className="text-[10px] font-bold text-muted block mb-1">Est. Calories Burned (kcal)</label>
                  <input
                    type="number"
                    value={activeWorkout.sportMetrics?.caloriesKcal || ""}
                    onChange={(e) =>
                      updateActiveWorkout((prev) => ({
                        sportMetrics: { ...prev.sportMetrics, caloriesKcal: e.target.value ? Number(e.target.value) : "" },
                      }))
                    }
                    placeholder="350"
                    className="w-full rounded-lg bg-surface px-2.5 py-1.5 text-xs text-text border border-border"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-muted block mb-1">Session Notes & Feel</label>
                  <textarea
                    rows={2}
                    value={activeWorkout.notes}
                    onChange={(e) => updateActiveWorkout({ notes: e.target.value })}
                    placeholder="RPE, energy level, form adjustments..."
                    className="w-full rounded-lg bg-surface px-2.5 py-1.5 text-xs text-text border border-border outline-none resize-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PLATE CALCULATOR POPUP */}
      {plateCalcTargetWeight !== null && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-[70] grid place-items-center bg-black/65 p-4 backdrop-blur-md"
        >
          <div className="w-full max-w-md card-glass rounded-2xl p-5 shadow-float space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-accent" />
                <h3 className="font-display font-bold text-text">Barbell Plate Calculator</h3>
              </div>
              <button
                type="button"
                onClick={() => setPlateCalcTargetWeight(null)}
                className="rounded-lg p-1 text-faint hover:text-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">Target Total Weight (kg)</label>
                <input
                  type="number"
                  step="2.5"
                  value={plateCalcTargetWeight}
                  onChange={(e) => setPlateCalcTargetWeight(Number(e.target.value))}
                  className="w-full rounded-lg bg-surface px-3 py-2 text-sm font-bold text-text border border-border"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted block mb-1">Bar Weight (kg)</label>
                <select
                  value={barWeight}
                  onChange={(e) => setBarWeight(Number(e.target.value))}
                  className="w-full rounded-lg bg-surface px-3 py-2 text-sm font-bold text-text border border-border"
                >
                  <option value={20}>20 kg (Standard Olympic Bar)</option>
                  <option value={15}>15 kg (Women / Technique Bar)</option>
                  <option value={10}>10 kg (EZ-Curl Bar)</option>
                </select>
              </div>
            </div>

            {/* Plates breakdown per side */}
            <div className="rounded-xl bg-surface-2 p-3.5 space-y-2">
              <span className="text-[11px] font-bold uppercase text-faint">Plates Needed Per Side:</span>
              {(() => {
                const { plates, remaining } = calculatePlates(plateCalcTargetWeight, barWeight);
                if (plates.length === 0) {
                  return <p className="text-xs text-muted">Just the barbell ({barWeight} kg)</p>;
                }
                return (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap gap-2">
                      {plates.map((item, idx) => (
                        <span
                          key={idx}
                          className="rounded-lg bg-accent/20 border border-accent/40 px-2.5 py-1 text-xs font-bold text-accent"
                        >
                          {item.count} × {item.plate} kg
                        </span>
                      ))}
                    </div>
                    {remaining > 0 && (
                      <p className="text-[11px] text-amber-400">
                        Remaining unmatchable weight: {remaining * 2} kg
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            <button
              type="button"
              onClick={() => setPlateCalcTargetWeight(null)}
              className="w-full btn-hero rounded-xl py-2.5 text-xs font-bold"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* DISCARD CONFIRMATION MODAL */}
      {confirmDiscardOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-[75] grid place-items-center bg-black/70 p-4 backdrop-blur-md"
        >
          <div className="w-full max-w-sm card-glass rounded-2xl p-5 shadow-float space-y-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-danger/15 text-danger">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-text">Discard this workout?</h3>
                <p className="text-xs text-muted">All tracked sets and timer progress will be lost.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDiscardOpen(false)}
                className="rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-xs font-semibold text-muted hover:text-text"
              >
                Keep Working Out
              </button>
              <button
                type="button"
                onClick={() => {
                  discardActiveWorkout();
                  setConfirmDiscardOpen(false);
                  onClose?.();
                }}
                className="rounded-xl bg-danger px-3.5 py-2 text-xs font-semibold text-white hover:bg-danger/90"
              >
                Discard Workout
              </button>
            </div>
          </div>
        </div>
      )}

      <ExerciseLibraryModal
        open={pickingExercise}
        onClose={() => setPickingExercise(false)}
        onSelectExercise={handleSelectExercise}
      />
    </div>
  );
}
