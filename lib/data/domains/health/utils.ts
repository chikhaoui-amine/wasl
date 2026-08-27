import { addDays, fromISO, streakFrom, todayISO, weekISO } from "@/lib/date";
import type {
  HealthDay,
  Workout,
  Exercise,
  LoggedSet,
  TrackingMode,
} from "./types";

export const lastNDays = (
  days: Record<string, HealthDay>,
  metric: keyof Pick<HealthDay, "steps" | "sleepH" | "waterCups">,
  n = 7,
) => {
  const t = todayISO();
  return Array.from({ length: n }, (_, i) => {
    const iso = addDays(t, -(n - 1 - i));
    const d = days[iso];
    return {
      iso,
      label: fromISO(iso).toLocaleDateString("en-US", { weekday: "short" }),
      value: d ? (d[metric] as number) : 0,
    };
  });
};

export const hasAnyLog = (
  days: Record<string, HealthDay>,
  metric: keyof Pick<HealthDay, "steps" | "sleepH" | "waterCups">,
) => Object.values(days).some((d) => (d[metric] as number) > 0);

export const weightSeries = (days: Record<string, HealthDay>) =>
  Object.entries(days)
    .filter(([, d]) => typeof d.weightKg === "number" && d.weightKg > 0)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([iso, d], idx, arr) => {
      const val = Number((d.weightKg as number).toFixed(1));
      const prevVal = idx > 0 ? (arr[idx - 1][1].weightKg as number) : undefined;
      const diff = prevVal !== undefined ? Number((val - prevVal).toFixed(1)) : undefined;
      return { iso, value: val, diff };
    });

/** minutes + session count for the current Mon..Sun week */
export const thisWeekActivity = (workouts: Workout[]) => {
  const w = weekISO();
  const inWeek = workouts.filter((x) => x.date >= w[0] && x.date <= w[6]);
  return {
    minutes: inWeek.reduce((s, x) => s + x.minutes, 0),
    sessions: inWeek.length,
  };
};

/** sessions per week for the last n weeks, oldest first */
export const sessionsByWeek = (workouts: Workout[], nWeeks = 4) => {
  const thisMonday = weekISO()[0];
  return Array.from({ length: nWeeks }, (_, i) => {
    const start = addDays(thisMonday, -(nWeeks - 1 - i) * 7);
    const end = addDays(start, 6);
    const count = workouts.filter((x) => x.date >= start && x.date <= end).length;
    const label = fromISO(start).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { start, label, count };
  });
};

/** minutes per sport over the last 30 days, biggest first */
export const sportBreakdown = (workouts: Workout[], daysBack = 30) => {
  const cutoff = addDays(todayISO(), -daysBack);
  const map = new Map<string, { minutes: number; sessions: number }>();
  workouts
    .filter((x) => x.date >= cutoff)
    .forEach((x) => {
      const cur = map.get(x.sport) ?? { minutes: 0, sessions: 0 };
      map.set(x.sport, { minutes: cur.minutes + x.minutes, sessions: cur.sessions + 1 });
    });
  return [...map.entries()]
    .map(([sport, v]) => ({ sport, ...v }))
    .sort((a, b) => b.minutes - a.minutes);
};

/** consecutive days (ending today/yesterday) with at least one workout */
export const activityStreak = (workouts: Workout[]) =>
  streakFrom(new Set(workouts.map((w) => w.date)));

/** 30-day activity matrix per date */
export const sportsHeatmap = (workouts: Workout[], daysCount = 30) => {
  const t = todayISO();
  return Array.from({ length: daysCount }, (_, i) => {
    const iso = addDays(t, -(daysCount - 1 - i));
    const dayWorkouts = workouts.filter((w) => w.date === iso);
    return {
      iso,
      workouts: dayWorkouts,
      hasWorkout: dayWorkouts.length > 0,
    };
  });
};

/** Calculate estimated 1RM (Epley Formula: Weight * (1 + Reps/30)) */
export const calc1RM = (weightKg: number, reps: number): number => {
  if (!weightKg || !reps) return 0;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30));
};

/** Extract PR list across all completed workouts */
export const extractAllPRs = (workouts: Workout[]) => {
  const exercisePRs: Record<string, { maxWeight: number; maxVolume: number; max1RM: number; lastDate: string }> = {};

  (workouts || []).forEach((w) => {
    if (!w || !w.detailedExercises) return;
    (w.detailedExercises || []).forEach((ex) => {
      (ex.sets || []).forEach((set) => {
        if (!set.completed || set.type === "W") return;
        const cur = exercisePRs[ex.exerciseName] || { maxWeight: 0, maxVolume: 0, max1RM: 0, lastDate: w.date };
        const e1rm = calc1RM(set.weightKg, set.reps);
        const volume = set.weightKg * set.reps;

        if (set.weightKg > cur.maxWeight || volume > cur.maxVolume || e1rm > cur.max1RM) {
          exercisePRs[ex.exerciseName] = {
            maxWeight: Math.max(cur.maxWeight, set.weightKg),
            maxVolume: Math.max(cur.maxVolume, volume),
            max1RM: Math.max(cur.max1RM, e1rm),
            lastDate: w.date > cur.lastDate ? w.date : cur.lastDate,
          };
        }
      });
    });
  });

  return exercisePRs;
};

export function getExerciseTrackingMode(name: string, category?: string, equipment?: string): TrackingMode {
  const n = (name || "").toLowerCase();
  if (
    n.includes("hold") ||
    n.includes("plank") ||
    n.includes("l-sit") ||
    n.includes("wall sit") ||
    n.includes("hollow") ||
    n.includes("stretch") ||
    n.includes("handstand")
  ) {
    return "hold";
  }
  if (
    category === "Running" ||
    category === "Swimming" ||
    n.includes("sprint") ||
    n.includes("interval") ||
    n.includes("laps") ||
    n.includes("erg") ||
    n.includes("rowing") ||
    n.includes("fartlek")
  ) {
    return "cardio_set";
  }
  if (
    category === "Calisthenics" ||
    equipment === "Bodyweight" ||
    n.includes("push-up") ||
    n.includes("pull-up") ||
    n.includes("chin-up") ||
    n.includes("dip") ||
    n.includes("burpee")
  ) {
    return "bodyweight";
  }
  return "weight_reps";
}

/** Formats a logged set cleanly based on exercise tracking mode, ensuring weight & reps are shown for gym exercises */
export function formatSetSummary(set: LoggedSet, mode?: TrackingMode, exerciseName?: string): string {
  const effectiveMode = mode || (exerciseName ? getExerciseTrackingMode(exerciseName) : "weight_reps");

  if (effectiveMode === "hold") {
    const time = set.durationSec ?? 30;
    return `${time}s${set.weightKg && set.weightKg > 0 ? ` (+${set.weightKg}kg)` : ""}`;
  }

  if (effectiveMode === "cardio_set") {
    const dist = set.distanceMeters;
    const dur = set.durationSec;
    if (dist && dur) return `${dist}m (${dur}s)`;
    if (dist) return `${dist}m`;
    if (dur) return `${dur}s`;
    return "1 set";
  }

  if (effectiveMode === "bodyweight") {
    const reps = set.reps ?? 0;
    if (set.weightKg && set.weightKg > 0) {
      return `${set.weightKg}kg × ${reps}`;
    }
    return `${reps} reps`;
  }

  // default: weight_reps
  const weight = set.weightKg ?? 0;
  const reps = set.reps ?? 0;
  if (weight > 0) {
    return `${weight}kg × ${reps}`;
  }
  return `${reps} reps`;
}

export interface SleepDataPoint {
  iso: string;
  sleepH: number;
  sleepQuality?: string;
  sleepNote?: string;
  soreness?: number;
  energy?: number;
  steps?: number;
  waterCups?: number;
  weightKg?: number;
  hasLog: boolean;
}

/** Generates sleep series for the past N days ending today */
export const sleepSeries = (days: Record<string, HealthDay>, daysCount = 7): SleepDataPoint[] => {
  const t = todayISO();
  return Array.from({ length: daysCount }, (_, i) => {
    const iso = addDays(t, -(daysCount - 1 - i));
    const dayData = days[iso];
    return {
      iso,
      sleepH: dayData?.sleepH ?? 0,
      sleepQuality: dayData?.sleepQuality,
      sleepNote: dayData?.sleepNote,
      soreness: dayData?.soreness,
      energy: dayData?.energy,
      steps: dayData?.steps,
      waterCups: dayData?.waterCups,
      weightKg: dayData?.weightKg,
      hasLog: dayData !== undefined && (dayData.sleepH > 0 || !!dayData.sleepQuality),
    };
  });
};

/** Calculate sleep summary metrics for a given day window */
export const sleepStats = (days: Record<string, HealthDay>, targetH = 8, daysCount = 7) => {
  const series = sleepSeries(days, daysCount);
  const logged = series.filter((d) => d.sleepH > 0);
  const totalLoggedHours = logged.reduce((acc, d) => acc + d.sleepH, 0);
  const avgSleep = logged.length > 0 ? Number((totalLoggedHours / logged.length).toFixed(1)) : 0;
  const targetMetDays = logged.filter((d) => d.sleepH >= targetH).length;
  const targetHitRate = logged.length > 0 ? Math.round((targetMetDays / logged.length) * 100) : 0;
  const bestSleep = logged.length > 0 ? Math.max(...logged.map((d) => d.sleepH)) : 0;

  return {
    avgSleep,
    targetHitRate,
    bestSleep,
    loggedDaysCount: logged.length,
    totalDays: daysCount,
    totalHours: totalLoggedHours,
  };
};

export interface ExerciseSessionPoint {
  workoutId: string;
  iso: string;
  maxWeightKg: number;
  max1RM: number;
  totalVolumeKg: number;
  completedSetsCount: number;
  sets: LoggedSet[];
  trackingMode?: TrackingMode;
  notes?: string;
  hasPR: boolean;
}

/** Extract full chronological progression data for a specific exercise */
export const exerciseProgression = (workouts: Workout[], exerciseName: string): ExerciseSessionPoint[] => {
  const points: ExerciseSessionPoint[] = [];

  (workouts || [])
    .filter((w) => w && w.detailedExercises)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .forEach((w) => {
      const match = (w.detailedExercises || []).find(
        (e) => e && e.exerciseName && e.exerciseName.toLowerCase() === exerciseName.toLowerCase(),
      );
      if (!match) return;

      const completedSets = (match.sets || []).filter((s) => s && s.completed);
      if (completedSets.length === 0) return;

      let maxWeight = 0;
      let max1RM = 0;
      let totalVolume = 0;
      let hasPR = false;

      completedSets.forEach((s) => {
        if (s.isPR) hasPR = true;
        const weight = s.weightKg || 0;
        const reps = s.reps || 0;
        if (weight > maxWeight) maxWeight = weight;
        const e1rm = calc1RM(weight, reps);
        if (e1rm > max1RM) max1RM = e1rm;
        totalVolume += weight * reps;
      });

      points.push({
        workoutId: w.id,
        iso: w.date,
        maxWeightKg: maxWeight,
        max1RM,
        totalVolumeKg: totalVolume,
        completedSetsCount: completedSets.length,
        sets: completedSets,
        trackingMode: match.trackingMode,
        notes: match.notes,
        hasPR,
      });
    });

  return points;
};

export interface ExerciseOption {
  name: string;
  category: string;
  loggedSessionsCount: number;
  maxWeight: number;
  max1RM: number;
  lastLoggedDate?: string;
}

/** Returns list of all available exercises sorted by logged activity and alphabetical */
export const getAvailableExercises = (
  exercises: Exercise[],
  workouts: Workout[],
): ExerciseOption[] => {
  const prs = extractAllPRs(workouts);
  const workoutCounts: Record<string, { count: number; lastDate: string }> = {};

  (workouts || []).forEach((w) => {
    (w.detailedExercises || []).forEach((e) => {
      if (!e || !e.exerciseName) return;
      const completed = (e.sets || []).some((s) => s && s.completed);
      if (completed) {
        const cur = workoutCounts[e.exerciseName] || { count: 0, lastDate: w.date };
        workoutCounts[e.exerciseName] = {
          count: cur.count + 1,
          lastDate: w.date > cur.lastDate ? w.date : cur.lastDate,
        };
      }
    });
  });

  const map = new Map<string, ExerciseOption>();

  // Add all library exercises
  (exercises || []).forEach((ex) => {
    if (!ex || !ex.name) return;
    const pr = prs[ex.name];
    const logInfo = workoutCounts[ex.name];
    map.set(ex.name, {
      name: ex.name,
      category: ex.category || "Gym",
      loggedSessionsCount: logInfo?.count || 0,
      maxWeight: pr?.maxWeight || 0,
      max1RM: pr?.max1RM || 0,
      lastLoggedDate: logInfo?.lastDate,
    });
  });

  // Add any exercises from workouts not in DEFAULT_EXERCISES
  (workouts || []).forEach((w) => {
    (w.detailedExercises || []).forEach((e) => {
      if (!e || !e.exerciseName) return;
      if (!map.has(e.exerciseName)) {
        const pr = prs[e.exerciseName];
        const logInfo = workoutCounts[e.exerciseName];
        map.set(e.exerciseName, {
          name: e.exerciseName,
          category: "Gym",
          loggedSessionsCount: logInfo?.count || 0,
          maxWeight: pr?.maxWeight || 0,
          max1RM: pr?.max1RM || 0,
          lastLoggedDate: logInfo?.lastDate,
        });
      }
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    if (a.loggedSessionsCount !== b.loggedSessionsCount) {
      return b.loggedSessionsCount - a.loggedSessionsCount;
    }
    return a.name.localeCompare(b.name);
  });
};

export const calcTotalWorkoutVolume = (detailedExercises?: { sets?: LoggedSet[] }[]) => {
  if (!detailedExercises) return 0;
  return detailedExercises.reduce((total, ex) => {
    const exVolume = (ex.sets || []).reduce((setTotal, set) => {
      if (!set.completed) return setTotal;
      return setTotal + (set.weightKg || 0) * (set.reps || 0);
    }, 0);
    return total + exVolume;
  }, 0);
};
