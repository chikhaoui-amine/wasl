export interface HealthDay {
  steps: number;
  sleepH: number;
  waterCups: number;
  weightKg?: number;
  soreness?: number; // 1-5 scale
  energy?: number; // 1-5 scale
  sleepQuality?: string;
  sleepNote?: string;
}

export interface Exercise {
  id: string;
  name: string;
  category: "Gym" | "Calisthenics" | "Running" | "Swimming" | "Boxing/Martial Arts" | "Other";
  primaryMuscle: string;
  equipment: string;
  instructions?: string;
  isCustom?: boolean;
}

export interface TargetSet {
  type?: "W" | "N" | "D" | "F"; // Warmup, Normal, Drop, Failure
  reps: number;
  weightKg: number;
  durationSec?: number; // Hold time or duration in seconds
  distanceMeters?: number; // Distance in meters for cardio sets
  rpe?: number;
  restSec?: number;
}

export interface ProgramExercise {
  exerciseId: string;
  exerciseName: string;
  targetSets: TargetSet[];
  notes?: string;
  progressionRule?: string;
}

export interface ProgramSession {
  id: string;
  name: string;
  dayName: string;
  sport: string;
  exercises: ProgramExercise[];
  sportTargets?: {
    distanceKm?: number;
    durationMin?: number;
    intervals?: string;
    paceMinKm?: string;
    stroke?: string;
    laps?: number;
    rounds?: number;
    roundMin?: number;
    restMin?: number;
    sessionType?: string;
    goals?: number;
    assists?: number;
    yogaStyle?: string;
    caloriesKcal?: number;
  };
}

export interface WorkoutProgram {
  id: string;
  name: string;
  description?: string;
  sport: string;
  sessions: ProgramSession[];
  active?: boolean;
}

export interface LoggedSet {
  id: string;
  type?: "W" | "N" | "D" | "F";
  weightKg: number;
  reps: number;
  durationSec?: number; // Hold time or duration in seconds
  distanceMeters?: number; // Distance in meters for cardio intervals
  rpe?: number;
  completed: boolean;
  isPR?: boolean;
}

export type TrackingMode = "weight_reps" | "bodyweight" | "hold" | "cardio_set";

export interface LoggedExercise {
  exerciseId: string;
  exerciseName: string;
  trackingMode?: TrackingMode;
  sets: LoggedSet[];
  notes?: string;
}

export interface ActiveWorkout {
  id: string;
  sessionId?: string;
  sessionTitle: string;
  sport: string;
  startTime: number;
  elapsedSec: number;
  isPaused: boolean;
  lastTickAt: number;
  restTimerSec: number | null;
  restTimerTarget: number | null;
  loggedExercises: LoggedExercise[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sportMetrics: Record<string, any>;
  notes: string;
  isMinimized: boolean;
}

export interface ExerciseLog {
  id: string;
  name: string;
  sets?: number;
  reps?: number;
  weightKg?: number;
}

export interface Workout {
  id: string;
  date: string; // ISO day
  sport: string;
  minutes: number;
  intensity?: "light" | "moderate" | "vigorous";
  distanceKm?: number;
  exercises?: ExerciseLog[];
  detailedExercises?: LoggedExercise[];
  sportMetrics?: {
    distanceKm?: number;
    paceMinKm?: string;
    avgHeartRate?: number;
    elevationMeters?: number;
    avgSpeedKmh?: number;
    avgPowerWatts?: number;
    stroke?: string;
    laps?: number;
    rounds?: number;
    roundMin?: number;
    restMin?: number;
    sessionType?: string;
    goals?: number;
    assists?: number;
    yogaStyle?: string;
    yogaIntensity?: string;
    focusArea?: string;
    caloriesKcal?: number;
  };
  programId?: string;
  programSessionId?: string;
  soreness?: number;
  energy?: number;
  note?: string;
  prsEarned?: string[];
}
