import type { WorkoutProgram } from "@/lib/data/domains/health";

// Server-safe workout defaults. Keep this module free of React/Zustand imports so
// MCP route handlers can restore programs without crossing a `use client` boundary.
export const DEFAULT_PROGRAMS = [
  {
    id: "prog-ppl",
    name: "Push / Pull / Legs (PPL)",
    description: "Classic 3-day hypertrophy & strength split.",
    sport: "Gym",
    active: true,
    sessions: [
      {
        id: "sess-push",
        name: "Push Day (Chest, Shoulders, Triceps)",
        dayName: "Day 1",
        sport: "Gym",
        exercises: [
          {
            exerciseId: "ex-bench-press",
            exerciseName: "Barbell Bench Press",
            targetSets: [
              { type: "W", reps: 10, weightKg: 50 },
              { type: "N", reps: 8, weightKg: 70, rpe: 8, restSec: 120 },
              { type: "N", reps: 8, weightKg: 70, rpe: 8, restSec: 120 },
              { type: "N", reps: 8, weightKg: 70, rpe: 9, restSec: 120 },
            ],
            progressionRule: "+2.5kg when all sets reach 8 reps",
          },
          {
            exerciseId: "ex-incline-db-press",
            exerciseName: "Incline Dumbbell Press",
            targetSets: [
              { type: "N", reps: 10, weightKg: 24, rpe: 8, restSec: 90 },
              { type: "N", reps: 10, weightKg: 24, rpe: 9, restSec: 90 },
              { type: "N", reps: 10, weightKg: 24, rpe: 9, restSec: 90 },
            ],
          },
          {
            exerciseId: "ex-lateral-raise",
            exerciseName: "Dumbbell Lateral Raise",
            targetSets: [
              { type: "N", reps: 12, weightKg: 10, rpe: 8, restSec: 60 },
              { type: "N", reps: 12, weightKg: 10, rpe: 9, restSec: 60 },
              { type: "N", reps: 15, weightKg: 10, rpe: 10, restSec: 60 },
            ],
          },
          {
            exerciseId: "ex-tricep-pushdown",
            exerciseName: "Cable Tricep Pushdown",
            targetSets: [
              { type: "N", reps: 12, weightKg: 30, rpe: 8, restSec: 60 },
              { type: "N", reps: 12, weightKg: 30, rpe: 9, restSec: 60 },
            ],
          },
        ],
      },
      {
        id: "sess-pull",
        name: "Pull Day (Back & Biceps)",
        dayName: "Day 2",
        sport: "Gym",
        exercises: [
          {
            exerciseId: "ex-barbell-row",
            exerciseName: "Barbell Bent-Over Row",
            targetSets: [
              { type: "N", reps: 8, weightKg: 60, rpe: 8, restSec: 120 },
              { type: "N", reps: 8, weightKg: 60, rpe: 8, restSec: 120 },
              { type: "N", reps: 8, weightKg: 60, rpe: 9, restSec: 120 },
            ],
          },
          {
            exerciseId: "ex-lat-pulldown",
            exerciseName: "Lat Pulldown",
            targetSets: [
              { type: "N", reps: 10, weightKg: 55, rpe: 8, restSec: 90 },
              { type: "N", reps: 10, weightKg: 55, rpe: 8, restSec: 90 },
              { type: "N", reps: 10, weightKg: 55, rpe: 9, restSec: 90 },
            ],
          },
          {
            exerciseId: "ex-db-bicep-curl",
            exerciseName: "Dumbbell Bicep Curl",
            targetSets: [
              { type: "N", reps: 12, weightKg: 12, rpe: 8, restSec: 60 },
              { type: "N", reps: 12, weightKg: 12, rpe: 9, restSec: 60 },
            ],
          },
        ],
      },
      {
        id: "sess-legs",
        name: "Leg Day (Quads, Hamstrings, Calves)",
        dayName: "Day 3",
        sport: "Gym",
        exercises: [
          {
            exerciseId: "ex-barbell-squat",
            exerciseName: "Barbell Back Squat",
            targetSets: [
              { type: "W", reps: 10, weightKg: 60 },
              { type: "N", reps: 8, weightKg: 90, rpe: 8, restSec: 120 },
              { type: "N", reps: 8, weightKg: 90, rpe: 8, restSec: 120 },
              { type: "N", reps: 8, weightKg: 90, rpe: 9, restSec: 120 },
            ],
          },
          {
            exerciseId: "ex-romanian-deadlift",
            exerciseName: "Romanian Deadlift",
            targetSets: [
              { type: "N", reps: 10, weightKg: 70, rpe: 8, restSec: 90 },
              { type: "N", reps: 10, weightKg: 70, rpe: 9, restSec: 90 },
            ],
          },
          {
            exerciseId: "ex-leg-press",
            exerciseName: "Leg Press",
            targetSets: [
              { type: "N", reps: 12, weightKg: 140, rpe: 8, restSec: 90 },
              { type: "N", reps: 12, weightKg: 140, rpe: 9, restSec: 90 },
            ],
          },
        ],
      },
    ],
  },
] satisfies WorkoutProgram[];
