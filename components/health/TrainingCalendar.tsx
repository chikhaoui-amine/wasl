"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Dumbbell,
  Trophy,
  Clock,
  Trash2,
  Calendar as CalendarIcon,
  Flame,
  Droplet,
  Footprints,
  Activity,
  Zap,
  Sparkles,
  Plus,
} from "lucide-react";
import {
  useHealthData,
  formatSetSummary,
  type Workout,
  type LoggedExercise,
} from "@/lib/data/domains/health";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { addDays, fromISO, relLabel, todayISO } from "@/lib/date";
import { cn } from "@/lib/utils";

interface TrainingCalendarProps {
  onStartWorkoutClick?: (sport?: string) => void;
}

export function TrainingCalendar({ onStartWorkoutClick }: TrainingCalendarProps) {
  const { workouts, deleteWorkout } = useHealthData();
  const t = todayISO();
  const [anchorMonth, setAnchorMonth] = useState(t.slice(0, 7)); // YYYY-MM
  const [selectedDate, setSelectedDate] = useState<string>(t);

  const year = Number(anchorMonth.slice(0, 4));
  const monthIdx = Number(anchorMonth.slice(5, 7)) - 1;

  const monthDate = new Date(year, monthIdx, 1);
  const monthName = monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, monthIdx, 1).getDay() + 6) % 7; // Monday = 0

  const handleShiftMonth = (dir: -1 | 1) => {
    const nextDate = new Date(year, monthIdx + dir, 1);
    const yStr = nextDate.getFullYear();
    const mStr = (nextDate.getMonth() + 1).toString().padStart(2, "0");
    setAnchorMonth(`${yStr}-${mStr}`);
  };

  const handleShiftDay = (dir: -1 | 1) => {
    const newDate = addDays(selectedDate, dir);
    setSelectedDate(newDate);
    if (newDate.slice(0, 7) !== anchorMonth) {
      setAnchorMonth(newDate.slice(0, 7));
    }
  };

  // Group workouts by ISO date
  const workoutsByDate: Record<string, Workout[]> = {};
  (workouts || []).forEach((w) => {
    if (!w || !w.date) return;
    if (!workoutsByDate[w.date]) workoutsByDate[w.date] = [];
    workoutsByDate[w.date].push(w);
  });

  const selectedDayWorkouts = workoutsByDate[selectedDate] || [];
  const selectedDayTotalMinutes = selectedDayWorkouts.reduce((acc, w) => acc + w.minutes, 0);

  const getSportIcon = (sport: string) => {
    switch (sport) {
      case "Gym":
        return Dumbbell;
      case "Running":
      case "Cycling":
        return Footprints;
      case "Swimming":
        return Droplet;
      case "Martial arts":
        return Flame;
      case "Calisthenics":
        return Zap;
      default:
        return Activity;
    }
  };

  return (
    <div className="space-y-4">
      {/* Main Calendar Card */}
      <Card className="p-5 space-y-4">
        {/* Calendar Header Bar */}
        <div className="flex items-center justify-between">
          <SectionTitle>{monthName}</SectionTitle>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleShiftMonth(-1)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted hover:bg-surface-hover hover:text-text transition"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setAnchorMonth(t.slice(0, 7));
                setSelectedDate(t);
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-muted hover:bg-surface-hover hover:text-text transition"
            >
              Current Month
            </button>
            <button
              onClick={() => handleShiftMonth(1)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted hover:bg-surface-hover hover:text-text transition"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wider text-faint border-b border-border/60 pb-2">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
          <span>Sun</span>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {/* Padding empty slots for first day of month */}
          {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-16 rounded-xl bg-surface-2/20 opacity-20" />
          ))}

          {/* Month Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const iso = `${anchorMonth}-${dayNum.toString().padStart(2, "0")}`;
            const isToday = iso === t;
            const isSelected = iso === selectedDate;
            const dayWorkouts = workoutsByDate[iso] || [];
            const hasLogged = dayWorkouts.length > 0;

            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelectedDate(iso)}
                className={cn(
                  "h-16 rounded-xl border p-1.5 flex flex-col justify-between transition-all text-left outline-none",
                  isSelected
                    ? "border-accent ring-2 ring-accent/50 bg-surface-hover shadow-md scale-[1.02] z-10"
                    : isToday
                    ? "border-accent/80 bg-accent/10"
                    : hasLogged
                    ? "border-emerald-500/40 bg-emerald-500/10 hover:border-emerald-500/80 hover:bg-emerald-500/15"
                    : "border-border/40 bg-surface-1/40 hover:bg-surface-2/60 hover:border-border/80",
                )}
              >
                <div className="flex items-center justify-between text-[11px] w-full">
                  <span
                    className={cn(
                      "tabular grid h-5 w-5 place-items-center rounded-full font-semibold",
                      isSelected
                        ? "bg-accent text-accent-fg font-extrabold"
                        : isToday
                        ? "bg-accent/30 text-accent font-bold"
                        : "text-muted",
                    )}
                  >
                    {dayNum}
                  </span>
                  {hasLogged && (
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-black shrink-0">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                  )}
                </div>

                {hasLogged ? (
                  <div className="space-y-0.5 overflow-hidden w-full">
                    {dayWorkouts.map((w) => (
                      <div
                        key={w.id}
                        className="truncate text-[9px] font-bold text-emerald-400 bg-emerald-500/20 px-1 py-0.5 rounded"
                        title={`${w.sport} (${w.minutes} min)`}
                      >
                        {w.sport} · {w.minutes}m
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[9px] text-faint">Rest</div>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Organized Daily Workout History Panel */}
      <Card className="p-5 space-y-4 border-2 border-border/80 bg-surface-1/90 shadow-sm">
        {/* Day Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => handleShiftDay(-1)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted hover:bg-surface-hover hover:text-text transition"
              title="Previous Day"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-accent" />
                <h3 className="font-display text-base font-bold text-text">
                  {fromISO(selectedDate).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </h3>
                <span className="rounded-full bg-accent/15 border border-accent/30 px-2 py-0.2 text-[10px] font-bold text-accent">
                  {relLabel(selectedDate)}
                </span>
              </div>
            </div>

            <button
              onClick={() => handleShiftDay(1)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted hover:bg-surface-hover hover:text-text transition"
              title="Next Day"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {selectedDayWorkouts.length > 0 ? (
              <span className="text-xs font-semibold text-muted bg-surface-2 px-3 py-1 rounded-lg border border-border/60">
                {selectedDayWorkouts.length} workout{selectedDayWorkouts.length > 1 ? "s" : ""} · {selectedDayTotalMinutes} mins total
              </span>
            ) : (
              <span className="text-xs font-semibold text-faint bg-surface-2/60 px-3 py-1 rounded-lg">
                Rest Day
              </span>
            )}
            {onStartWorkoutClick && (
              <button
                onClick={() => onStartWorkoutClick()}
                className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-fg shadow-sm hover:brightness-110 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Log Workout
              </button>
            )}
          </div>
        </div>

        {/* Workouts for Selected Day */}
        {selectedDayWorkouts.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-faint">
              <Dumbbell className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-text">No workouts logged on this day</p>
            <p className="text-xs text-faint max-w-sm mx-auto">
              This was a rest or recovery day. Select another day with a checkmark above to view past workout logs.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {selectedDayWorkouts.map((w) => {
              const Icon = getSportIcon(w.sport);
              return (
                <div
                  key={w.id}
                  className="rounded-2xl border border-border/80 bg-surface-2/40 p-4 space-y-3 transition-all hover:border-accent/40"
                >
                  {/* Workout Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-base text-text">{w.sport} Workout</h4>
                          {w.intensity && (
                            <span className="capitalize rounded-md bg-surface-2 border border-border px-2 py-0.2 text-[10px] font-semibold text-muted">
                              {w.intensity}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted">
                          <span className="flex items-center gap-1 font-semibold text-text">
                            <Clock className="h-3.5 w-3.5 text-accent" /> {w.minutes} mins
                          </span>
                          {w.sportMetrics?.distanceKm && (
                            <span>{w.sportMetrics.distanceKm} km</span>
                          )}
                          {w.sportMetrics?.avgSpeedKmh && (
                            <span>{w.sportMetrics.avgSpeedKmh} km/h</span>
                          )}
                          {w.sportMetrics?.laps && (
                            <span>{w.sportMetrics.laps} laps ({w.sportMetrics.stroke || "Freestyle"})</span>
                          )}
                          {w.sportMetrics?.rounds && (
                            <span>{w.sportMetrics.rounds} rounds ({w.sportMetrics.sessionType || "Bag work"})</span>
                          )}
                          {w.sportMetrics?.yogaStyle && (
                            <span>{w.sportMetrics.yogaStyle}</span>
                          )}
                          {w.sportMetrics?.caloriesKcal && (
                            <span>🔥 {w.sportMetrics.caloriesKcal} kcal</span>
                          )}
                          {w.soreness && (
                            <span>Soreness: {w.soreness}/5</span>
                          )}
                          {w.energy && (
                            <span>Energy: {w.energy}/5</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {w.prsEarned && w.prsEarned.length > 0 && (
                        <div className="flex items-center gap-1 rounded-full bg-warn/15 border border-warn/30 px-2.5 py-1 text-[11px] font-bold text-warn">
                          <Trophy className="h-3.5 w-3.5" />
                          <span>{w.prsEarned.length} PR{w.prsEarned.length > 1 ? "s" : ""}</span>
                        </div>
                      )}
                      <button
                        onClick={() => deleteWorkout(w.id)}
                        className="rounded-lg p-1.5 text-faint hover:bg-surface-hover hover:text-danger transition"
                        title="Delete workout"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Workout Note */}
                  {w.note && (
                    <p className="text-xs text-muted italic bg-surface-1/60 px-3 py-1.5 rounded-xl border border-border/40">
                      &quot;{w.note}&quot;
                    </p>
                  )}

                  {/* Detailed Exercises & Completed Sets */}
                  {w.detailedExercises && w.detailedExercises.length > 0 && (
                    <div className="space-y-2.5 border-t border-border/60 pt-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-faint">
                        Exercises & Completed Sets ({w.detailedExercises.length})
                      </span>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {w.detailedExercises.map((ex, exIdx) => {
                          const completedSets = ex.sets.filter((s) => s.completed);
                          if (completedSets.length === 0) return null;

                          return (
                            <div
                              key={exIdx}
                              className="rounded-xl border border-border/60 bg-surface-1/80 p-3 space-y-1.5"
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-text">{ex.exerciseName}</span>
                                <span className="text-[10px] text-faint font-semibold">
                                  {completedSets.length} set{completedSets.length > 1 ? "s" : ""}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {completedSets.map((s, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className={cn(
                                      "rounded-md px-2 py-0.5 text-[10px] font-semibold border",
                                      s.isPR
                                        ? "border-warn/50 bg-warn/15 text-warn font-bold"
                                        : "border-border/70 bg-surface-2 text-muted",
                                    )}
                                  >
                                    {formatSetSummary(s, ex.trackingMode, ex.exerciseName)}
                                    {s.isPR && " ⭐"}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
