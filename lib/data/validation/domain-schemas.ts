import { z } from "zod";
import type { StoreKey } from "../store-registry";

// ============================================================
// 1. NOTES DOMAIN SCHEMA (lifeos-notes)
// ============================================================

export const NoteCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  color: z.string(),
  icon: z.string().optional(),
  linkedCategoryIds: z.array(z.string()).optional(),
});

export const NoteContentTypeSchema = z.enum(["note", "read", "listen", "idea"]);

export const NoteSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  body: z.string(),
  tag: z.string(),
  pinned: z.boolean(),
  updatedAt: z.number(),
  contentType: NoteContentTypeSchema.optional(),
  sourceUrl: z.string().optional(),
  author: z.string().optional(),
});

export const NotesStateSchema = z.object({
  notes: z.array(NoteSchema),
  categories: z.array(NoteCategorySchema),
  graphPositions: z.record(z.string(), z.object({ x: z.number(), y: z.number() })).optional(),
});

// ============================================================
// 2. TRASH DOMAIN SCHEMA (lifeos-trash)
// ============================================================

// Must mirror lib/data/domains/trash/operations.ts TrashItemType exactly.
export const TrashItemTypeSchema = z.enum([
  "program",
  "workout",
  "task",
  "note",
  "goal",
  "habit",
]);

// Must mirror the runtime TrashItem interface: `itemType` (not `type`),
// ISO-string `deletedAt`, opaque `itemData` payload, `originalStoreKey`.
export const TrashItemSchema = z.object({
  id: z.string().min(1),
  itemType: TrashItemTypeSchema,
  title: z.string(),
  description: z.string().optional(),
  itemData: z.unknown(),
  deletedAt: z.string(),
  originalStoreKey: z.string().min(1),
});

export const TrashStateSchema = z.object({
  items: z.array(TrashItemSchema),
});

// ============================================================
// 3. HEALTH DOMAIN SCHEMA (lifeos-health)
// ============================================================

export const HealthDaySchema = z
  .object({
    steps: z.union([z.number(), z.string()]).optional(),
    waterCups: z.union([z.number(), z.string()]).optional(),
    sleepH: z.union([z.number(), z.string()]).optional(),
    weightKg: z.union([z.number(), z.string()]).optional(),
    soreness: z.union([z.number(), z.string()]).optional(),
    energy: z.union([z.number(), z.string()]).optional(),
    sleepQuality: z.string().optional(),
    sleepNote: z.string().optional(),
  })
  .passthrough();

export const TargetSetSchema = z
  .object({
    setNumber: z.union([z.number(), z.string()]).optional(),
    type: z.string().optional(),
    reps: z.union([z.number(), z.string()]).optional(),
    targetReps: z.union([z.number(), z.string()]).optional(),
    weightKg: z.union([z.number(), z.string()]).optional(),
    targetWeightKg: z.union([z.number(), z.string()]).optional(),
    durationSec: z.union([z.number(), z.string()]).optional(),
    targetHoldSeconds: z.union([z.number(), z.string()]).optional(),
    distanceMeters: z.union([z.number(), z.string()]).optional(),
    targetDistanceKm: z.union([z.number(), z.string()]).optional(),
    targetTimeSeconds: z.union([z.number(), z.string()]).optional(),
    rpe: z.union([z.number(), z.string()]).optional(),
    restSec: z.union([z.number(), z.string()]).optional(),
    restSeconds: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough();

export const ProgramExerciseSchema = z
  .object({
    exerciseId: z.string(),
    exerciseName: z.string(),
    targetSets: z.array(TargetSetSchema).optional(),
    sets: z.union([z.number(), z.string(), z.array(TargetSetSchema)]).optional(),
    notes: z.string().optional(),
    progressionRule: z.string().optional(),
  })
  .passthrough();

export const ProgramSessionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    dayName: z.string().optional(),
    dayOfWeek: z.union([z.number(), z.string()]).optional(),
    sport: z.string().optional(),
    exercises: z.array(ProgramExerciseSchema).optional().default([]),
    sportTargets: z.record(z.string(), z.any()).optional(),
    notes: z.string().optional(),
  })
  .passthrough();

export const WorkoutProgramSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    description: z.string().optional(),
    sport: z.string().optional(),
    sessions: z.array(ProgramSessionSchema).optional().default([]),
    active: z.boolean().optional(),
    isCustom: z.boolean().optional(),
  })
  .passthrough();

export const TrackingModeSchema = z.union([
  z.enum(["weight_reps", "bodyweight", "hold", "cardio_set"]),
  z.string(),
]);

export const LoggedSetSchema = z
  .object({
    id: z.string().optional(),
    setNumber: z.union([z.number(), z.string()]).optional(),
    type: z.string().optional(),
    weightKg: z.union([z.number(), z.string()]).optional(),
    reps: z.union([z.number(), z.string()]).optional(),
    durationSec: z.union([z.number(), z.string()]).optional(),
    holdSeconds: z.union([z.number(), z.string()]).optional(),
    distanceMeters: z.union([z.number(), z.string()]).optional(),
    distanceKm: z.union([z.number(), z.string()]).optional(),
    timeSeconds: z.union([z.number(), z.string()]).optional(),
    rpe: z.union([z.number(), z.string()]).optional(),
    completed: z.boolean().optional(),
    isPR: z.boolean().optional(),
    isWarmup: z.boolean().optional(),
    isDropSet: z.boolean().optional(),
  })
  .passthrough();

export const LoggedExerciseSchema = z
  .object({
    exerciseId: z.string(),
    exerciseName: z.string(),
    trackingMode: TrackingModeSchema.optional(),
    sets: z.array(LoggedSetSchema).optional().default([]),
    notes: z.string().optional(),
  })
  .passthrough();

export const ActiveWorkoutSchema = z
  .object({
    id: z.string().optional(),
    sessionId: z.string().optional(),
    sessionTitle: z.string().optional(),
    sessionName: z.string().optional(),
    sport: z.string().optional(),
    startTime: z.number().optional(),
    startedAt: z.number().optional(),
    elapsedSec: z.number().optional(),
    elapsedSeconds: z.number().optional(),
    isPaused: z.boolean().optional(),
    lastTickAt: z.number().optional(),
    restTimerSec: z.number().nullable().optional(),
    restTimerTarget: z.number().nullable().optional(),
    restTimerSeconds: z.number().nullable().optional(),
    loggedExercises: z.array(LoggedExerciseSchema).optional(),
    exercises: z.array(LoggedExerciseSchema).optional(),
    activeExerciseIndex: z.number().optional(),
    sportMetrics: z.record(z.string(), z.any()).optional(),
    notes: z.string().optional(),
    isMinimized: z.boolean().optional(),
  })
  .passthrough();

export const ExerciseLogSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    exerciseId: z.string().optional(),
    exerciseName: z.string().optional(),
    sets: z.union([z.number(), z.string(), z.array(LoggedSetSchema)]).optional(),
    reps: z.union([z.number(), z.string()]).optional(),
    weightKg: z.union([z.number(), z.string()]).optional(),
    notes: z.string().optional(),
  })
  .passthrough();

export const ExerciseCategorySchema = z.union([
  z.enum([
    "Gym",
    "Calisthenics",
    "Running",
    "Swimming",
    "Boxing/Martial Arts",
    "Other",
  ]),
  z.string(),
]);

export const ExerciseSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    category: ExerciseCategorySchema,
    equipment: z.string().optional(),
    primaryMuscle: z.string().optional(),
    primaryMuscles: z.array(z.string()).optional(),
    secondaryMuscles: z.array(z.string()).optional(),
    instructions: z.string().optional(),
    isCustom: z.boolean().optional(),
    sport: z.string().optional(),
  })
  .passthrough();

export const WorkoutSchema = z
  .object({
    id: z.string().min(1),
    date: z.string(),
    title: z.string().optional(),
    sport: z.string(),
    minutes: z.union([z.number(), z.string()]).optional(),
    durationMinutes: z.union([z.number(), z.string()]).optional(),
    intensity: z.union([z.enum(["light", "moderate", "vigorous"]), z.string()]).optional(),
    distanceKm: z.union([z.number(), z.string()]).optional(),
    rpe: z.union([z.number(), z.string()]).optional(),
    note: z.string().optional(),
    notes: z.string().optional(),
    programId: z.string().optional(),
    programSessionId: z.string().optional(),
    soreness: z.union([z.number(), z.string()]).optional(),
    energy: z.union([z.number(), z.string()]).optional(),
    prsEarned: z.array(z.string()).optional(),
    exercises: z.array(ExerciseLogSchema).optional(),
    detailedExercises: z.array(LoggedExerciseSchema).optional(),
    sportMetrics: z.record(z.string(), z.any()).optional(),
  })
  .passthrough();

export const HealthGoalsSchema = z
  .object({
    steps: z.union([z.number(), z.string()]).optional(),
    waterCups: z.union([z.number(), z.string()]).optional(),
    sleepH: z.union([z.number(), z.string()]).optional(),
    sessionsPerWeek: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough();

export const HealthStateSchema = z
  .object({
    days: z.record(z.string(), HealthDaySchema).optional().default({}),
    workouts: z.array(WorkoutSchema).optional().default([]),
    customSports: z.array(z.string()).optional(),
    exercises: z.array(ExerciseSchema).optional(),
    programs: z.array(WorkoutProgramSchema).optional().default([]),
    goals: HealthGoalsSchema.optional(),
    activeWorkout: ActiveWorkoutSchema.nullable().optional(),
  })
  .passthrough();

// ============================================================
// 4. TOPICS DOMAIN SCHEMA (lifeos-topics)
// ============================================================

export const TopicResourceSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  url: z.string().optional(),
  done: z.boolean(),
});

export const TopicSubstepSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  done: z.boolean(),
});

export const TopicStepSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  done: z.boolean(),
  collapsed: z.boolean().optional(),
  substeps: z.array(TopicSubstepSchema).optional(),
});

export const TopicNoteSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  text: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  pinned: z.boolean().optional(),
  contentType: NoteContentTypeSchema.optional(),
  sourceUrl: z.string().optional(),
  author: z.string().optional(),
});

export const TopicSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  description: z.string(),
  roadmap: z.array(TopicStepSchema),
  resources: z.array(TopicResourceSchema),
  notes: z.array(TopicNoteSchema),
  createdAt: z.number(),
  touchedAt: z.number(),
});

export const TopicsStateSchema = z.object({
  topics: z.array(TopicSchema),
});

// ============================================================
// 5. GOALS DOMAIN SCHEMA (lifeos-goals)
// ============================================================

export const MilestoneSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  done: z.boolean(),
});

export const GoalTypeSchema = z.enum(["north_star", "yearly_outcome", "monthly_outcome", "challenge"]);
export const GoalStatusSchema = z.enum(["active", "paused", "completed", "later"]);

export const GoalSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  why: z.string().optional(),
  plan: z.string(),
  milestones: z.array(MilestoneSchema),
  start: z.string().optional(),
  end: z.string().optional(),
  targetYear: z.number().optional(),
  targetMonth: z.string().optional(),
  manualProgress: z.number(),
  completed: z.boolean(),
  category: z.string(),
  customCategoryColor: z.string().optional(),
  type: GoalTypeSchema.optional(),
  status: GoalStatusSchema.optional(),
  northStarId: z.string().optional(),
  isCurrentFocus: z.boolean().optional(),
  linkedOutcomeId: z.string().optional(),
});

export const GoalsStateSchema = z.object({
  goals: z.array(GoalSchema),
});

// ============================================================
// 6. TASKS DOMAIN SCHEMA (lifeos-tasks)
// ============================================================

export const PrioritySchema = z.enum(["low", "med", "high"]);
export const TaskStatusSchema = z.enum(["todo", "done"]);

export const TaskSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  status: TaskStatusSchema,
  priority: PrioritySchema,
  goalId: z.string().optional(),
  due: z.string().optional(),
  today: z.boolean(),
  weekly: z.boolean().optional(),
  estimateMin: z.number().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});

export const TasksStateSchema = z.object({
  tasks: z.array(TaskSchema),
  dailyFocus: z.record(z.string(), z.array(z.string())),
});

// ============================================================
// 7. BLOCKS DOMAIN SCHEMA (lifeos-blocks)
// ============================================================

export const BlockSchema = z.object({
  id: z.string().min(1),
  date: z.string(),
  start: z.number(),
  end: z.number(),
  title: z.string(),
  color: z.string(),
});

export const BlocksStateSchema = z.object({
  blocks: z.array(BlockSchema),
  view: z.enum(["week", "day"]).optional(),
  anchor: z.string().optional(),
});

// ============================================================
// 8. JOURNAL DOMAIN SCHEMA (lifeos-journal)
// ============================================================

export const MoodSchema = z.enum(["great", "good", "okay", "low", "rough"]);

export const JournalEntrySchema = z.object({
  id: z.string().min(1),
  date: z.string(),
  mood: MoodSchema,
  body: z.string(),
  createdAt: z.number(),
});

export const JournalStateSchema = z.object({
  entries: z.array(JournalEntrySchema),
});

// ============================================================
// 9. HABITS DOMAIN SCHEMA (lifeos-habits)
// ============================================================

export const HabitSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  category: z.string().optional(),
  icon: z.string(),
  targetPerWeek: z.number(),
  color: z.string(),
  log: z.record(z.string(), z.boolean()),
  createdAt: z.string(),
});

export const HabitsStateSchema = z.object({
  habits: z.array(HabitSchema),
});

// ============================================================
// 10. MONEY DOMAIN SCHEMA (lifeos-money)
// ============================================================

export const AccountTypeSchema = z.enum(["bank", "card", "cash", "savings", "investment", "wallet"]);

export const AccountSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: AccountTypeSchema,
  initialBalance: z.number(),
  currency: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  createdAt: z.string(),
  isArchived: z.boolean().optional(),
});

export const TxnSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  amount: z.number(),
  tag: z.string(),
  date: z.string(),
  accountId: z.string().optional(),
  transferAccountId: z.string().optional(),
});

export const SavingsGoalSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  current: z.number(),
  target: z.number(),
});

export const MoneyStateSchema = z.object({
  currency: z.string(),
  accounts: z.array(AccountSchema).optional().default([]),
  transactions: z.array(TxnSchema),
  savings: z.array(SavingsGoalSchema),
});

// ============================================================
// 11. RECURRING DOMAIN SCHEMA (lifeos-recurring)
// ============================================================

export const RecurrenceFreqSchema = z.enum(["daily", "weekly", "monthly", "custom"]);

export const RecurrenceRuleSchema = z.object({
  freq: RecurrenceFreqSchema,
  weekDays: z.array(z.number()).optional(),
  monthDay: z.number().optional(),
  intervalDays: z.number().optional(),
});

export const RecurringTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  rule: RecurrenceRuleSchema,
  startDate: z.string(),
  endDate: z.string().optional(),
  completions: z.record(z.string(), z.boolean()),
  createdAt: z.string(),
});

export const RecurringStateSchema = z.object({
  recurring: z.array(RecurringTaskSchema),
});

// ============================================================
// DOMAIN SCHEMA REGISTRY MAP
// ============================================================

export const STORE_STATE_SCHEMAS = {
  "lifeos-notes": NotesStateSchema,
  "lifeos-trash": TrashStateSchema,
  "lifeos-health": HealthStateSchema,
  "lifeos-topics": TopicsStateSchema,
    "lifeos-goals": GoalsStateSchema,
  "lifeos-tasks": TasksStateSchema,
  "lifeos-blocks": BlocksStateSchema,
  "lifeos-journal": JournalStateSchema,
  "lifeos-habits": HabitsStateSchema,
  "lifeos-money": MoneyStateSchema,
  "lifeos-recurring": RecurringStateSchema,
} as const;

export interface DomainValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  issues?: z.ZodIssue[];
}

/**
 * Validates the concrete state object for any active domain store against its strict schema.
 */
export function validateDomainStoreState<K extends StoreKey>(
  store: K,
  state: unknown,
): DomainValidationResult {
  const schema = STORE_STATE_SCHEMAS[store];
  if (!schema) {
    return {
      success: false,
      error: `No validation schema registered for active store "${store}".`,
    };
  }

  const result = schema.safeParse(state);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const formattedError = result.error.issues
    .map((i) => `[${store}] ${i.path.join(".") || "state"}: ${i.message}`)
    .join("; ");

  return {
    success: false,
    error: formattedError,
    issues: result.error.issues,
  };
}
