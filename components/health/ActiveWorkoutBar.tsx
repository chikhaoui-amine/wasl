"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  Play,
  Pause,
  Maximize2,
  Check,
  X,
  Dumbbell,
  Timer,
  Plus,
  Trash2,
} from "lucide-react";
import { useHealthData, getDisplayedWorkoutSeconds } from "@/lib/data/domains/health";
import { workoutAudio } from "@/lib/audio/workout-audio";
import { cn } from "@/lib/utils";

export function ActiveWorkoutBar() {
  const {
    activeWorkout,
    expandActiveWorkout,
    pauseActiveWorkout,
    resumeActiveWorkout,
    setRestTimer,
    finishActiveWorkout,
    discardActiveWorkout,
  } = useHealthData();

  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Active workout in-memory UI clock & audio chime trigger
  useEffect(() => {
    if (!activeWorkout) return;

    const interval = setInterval(() => {
      const currentNow = Date.now();
      setNow(currentNow);

      // Check if rest timer just completed to trigger audio chime
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

  if (!activeWorkout || !activeWorkout.isMinimized) {
    return null;
  }

  const fmtTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Count completed sets
  let totalSets = 0;
  let completedSets = 0;
  (activeWorkout.loggedExercises || []).forEach((ex) => {
    const sets = ex.sets || [];
    totalSets += sets.length;
    completedSets += sets.filter((s) => s.completed).length;
  });

  const handleFinish = (e: React.MouseEvent) => {
    e.stopPropagation();
    expandActiveWorkout(); // Expand modal so user sees PR celebration or summary
  };

  const handleDiscard = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDiscardOpen(true);
  };

  const confirmDiscard = (e: React.MouseEvent) => {
    e.stopPropagation();
    discardActiveWorkout();
    setConfirmDiscardOpen(false);
  };

  return (
    <>
      <div
        onClick={() => expandActiveWorkout()}
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-2xl cursor-pointer rounded-2xl border border-accent/40 bg-surface-1/95 p-3 shadow-float backdrop-blur-xl sm:bottom-6 sm:p-3.5 transition-all hover:border-accent hover:scale-[1.01] group"
        role="region"
        aria-label="Active workout in progress"
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Left info: Pulsing indicator, Session Name, and Set progress */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
              <Dumbbell className="h-5 w-5 animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="truncate font-display text-[13px] sm:text-[14px] font-bold text-text group-hover:text-accent transition-colors">
                  {activeWorkout.sessionTitle}
                </h4>
                <span className="hidden sm:inline-block rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent">
                  ACTIVE
                </span>
              </div>
              <p className="text-[11px] font-medium text-muted">
                {totalSets > 0 ? `${completedSets}/${totalSets} sets done` : `${activeWorkout.sport} Workout`}
                {activeWorkout.loggedExercises.length > 0 && (
                  <span className="text-faint"> · {activeWorkout.loggedExercises.length} exercises</span>
                )}
              </p>
            </div>
          </div>

          {/* Right controls: Elapsed timer, Rest timer pill, Pause/Resume, and Expand */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Rest Timer Banner */}
            {restTimerSec !== null && restTimerSec > 0 && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 text-[11px] font-bold text-amber-400 animate-pulse"
              >
                <Timer className="h-3.5 w-3.5" />
                <span>{fmtTimer(restTimerSec)}</span>
                <button
                  type="button"
                  onClick={() => setRestTimer(null)}
                  className="ml-0.5 hover:text-text"
                  title="Dismiss rest timer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Elapsed Timer Badge */}
            <div className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 font-mono text-[12px] font-bold text-text border border-border">
              <Clock className="h-3.5 w-3.5 text-accent" />
              <span>{fmtTimer(elapsedSec)}</span>
            </div>

            {/* Pause / Resume Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (activeWorkout.isPaused) resumeActiveWorkout();
                else pauseActiveWorkout();
              }}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface-2 text-muted hover:border-accent/40 hover:text-text transition-colors"
              title={activeWorkout.isPaused ? "Resume Timer" : "Pause Timer"}
            >
              {activeWorkout.isPaused ? (
                <Play className="h-4 w-4 text-emerald-400 fill-current" />
              ) : (
                <Pause className="h-4 w-4 text-accent" />
              )}
            </button>

            {/* Resume / Maximize Button */}
            <button
              type="button"
              onClick={() => expandActiveWorkout()}
              className="btn-hero flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] sm:text-[12px] font-bold shadow-sm"
              title="Expand Workout Studio"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Resume</span>
            </button>

            {/* Discard / Close Button */}
            <button
              type="button"
              onClick={handleDiscard}
              className="grid h-8 w-8 place-items-center rounded-lg text-faint hover:bg-danger/10 hover:text-danger transition-colors"
              title="Discard Workout"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Discard Confirmation Dialog */}
      {confirmDiscardOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 backdrop-blur-md"
        >
          <div className="w-full max-w-sm card-glass rounded-2xl p-5 shadow-float space-y-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-danger/15 text-danger">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-text">Discard Active Workout?</h3>
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
                onClick={confirmDiscard}
                className="rounded-xl bg-danger px-3.5 py-2 text-xs font-semibold text-white hover:bg-danger/90"
              >
                Discard Workout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
