import { describe, it, expect } from "vitest";
import {
  validateDomainStoreState,
  STORE_STATE_SCHEMAS,
  NotesStateSchema,
  TrashStateSchema,
  HealthStateSchema,
  TopicsStateSchema,
  GoalsStateSchema,
  TasksStateSchema,
  BlocksStateSchema,
  JournalStateSchema,
  HabitsStateSchema,
  MoneyStateSchema,
  RecurringStateSchema,
} from "./domain-schemas";
import { STORE_KEYS, type StoreKey } from "../store-registry";

describe("Domain Validation Schemas (All 11 Active Stores)", () => {
  it("validates notes state schema", () => {
    const validNotes = {
      notes: [
        { id: "n1", title: "Note 1", body: "Body 1", tag: "note", updatedAt: 123456789, pinned: false },
      ],
      categories: [{ id: "c1", name: "Work", color: "#blue" }],
    };
    expect(NotesStateSchema.safeParse(validNotes).success).toBe(true);
    expect(validateDomainStoreState("lifeos-notes", validNotes).success).toBe(true);

    const invalidNotes = {
      notes: [{ id: "n1", title: 123, tag: "invalid_tag" }], // bad types
      categories: [],
    };
    const res = validateDomainStoreState("lifeos-notes", invalidNotes);
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  it("validates trash state schema against the runtime TrashItem shape", () => {
    const validTrash = {
      items: [
        {
          id: "t1",
          itemType: "note",
          title: "Deleted Note",
          itemData: { id: "n1", title: "Deleted Note", body: "x", tag: "note", updatedAt: 1 },
          deletedAt: "2026-08-24T10:00:00.000Z",
          originalStoreKey: "lifeos-notes",
        },
        {
          id: "t2",
          itemType: "workout",
          title: "Old Workout",
          description: "leg day",
          itemData: { id: "w1", date: "2026-08-20", sport: "Gym" },
          deletedAt: "2026-08-21T09:00:00.000Z",
          originalStoreKey: "lifeos-health",
        },
      ],
    };
    expect(TrashStateSchema.safeParse(validTrash).success).toBe(true);
    expect(validateDomainStoreState("lifeos-trash", validTrash).success).toBe(true);

    const invalidTrash = {
      items: [{ id: "t1", itemType: "nonexistent_type", title: "Bad Type", deletedAt: 123 }],
    };
    expect(validateDomainStoreState("lifeos-trash", invalidTrash).success).toBe(false);
  });

  it("validates health state schema with canonical and legacy shapes", () => {
    const validHealth = {
      days: {
        "2026-08-23": { steps: "10000", waterCups: 8, sleepH: "7.5", weightKg: "82.5", soreness: 2, energy: 4 },
      },
      workouts: [
        {
          id: "w1",
          date: "2026-08-23",
          title: "Leg Day",
          sport: "Gym",
          minutes: "60",
          intensity: "vigorous",
          detailedExercises: [
            {
              exerciseId: "ex-squat",
              exerciseName: "Barbell Squat",
              trackingMode: "weight_reps",
              sets: [
                { id: "s1", type: "W", reps: 10, weightKg: 60, completed: true },
                { id: "s2", type: "N", reps: "8", weightKg: "100", completed: true, isPR: true },
                { reps: 5, weightKg: 120, completed: true }, // LoggedSet without setNumber or id
              ],
            },
            {
              exerciseId: "ex-running",
              exerciseName: "Track Sprint",
              sets: [
                { durationSec: 30, distanceMeters: 200, completed: true },
              ],
            },
          ],
        },
      ],
      exercises: [
        { id: "ex-1", name: "Push-ups", category: "Calisthenics", equipment: "Bodyweight", primaryMuscle: "Chest" },
        { id: "ex-2", name: "5k Run", category: "Running", equipment: "Track", primaryMuscle: "Cardio" },
        { id: "ex-3", name: "Heavy Bag", category: "Boxing/Martial Arts", equipment: "Ring/Bag", primaryMuscle: "Full Body" },
      ],
      programs: [
        {
          id: "p1",
          name: "Hypertrophy",
          sport: "Gym",
          sessions: [
            {
              id: "s1",
              name: "Session A",
              dayName: "Day 1",
              sport: "Gym",
              exercises: [
                {
                  exerciseId: "ex-squat",
                  exerciseName: "Barbell Squat",
                  targetSets: [
                    { type: "W", reps: 10, weightKg: 60 },
                    { type: "N", reps: "8", weightKg: "100", restSec: 120 },
                  ],
                },
              ],
            },
          ],
        },
      ],
      goals: { steps: "10000", waterCups: 8, sleepH: 8, sessionsPerWeek: "4" },
      activeWorkout: null,
    };
    expect(HealthStateSchema.safeParse(validHealth).success).toBe(true);
    expect(validateDomainStoreState("lifeos-health", validHealth).success).toBe(true);
  });

  it("validates topics state schema", () => {
    const validTopics = {
      topics: [
        {
          id: "top-1",
          name: "TypeScript",
          icon: "code",
          color: "#blue",
          description: "Learn advanced TS",
          roadmap: [{ id: "step-1", title: "Generics", done: true }],
          resources: [{ id: "res-1", title: "Docs", done: false }],
          notes: [{ id: "note-1", title: "Key", text: "Insight", createdAt: 1, updatedAt: 2 }],
          createdAt: 1000,
          touchedAt: 2000,
        },
      ],
    };
    expect(TopicsStateSchema.safeParse(validTopics).success).toBe(true);
    expect(validateDomainStoreState("lifeos-topics", validTopics).success).toBe(true);
  });

  it("validates goals state schema", () => {
    const validGoals = {
      goals: [
        {
          id: "g1",
          title: "Run Marathon",
          plan: "Train 4 days a week",
          milestones: [{ id: "m1", title: "Half marathon", done: false }],
          manualProgress: 30,
          completed: false,
          category: "Fitness",
          type: "challenge",
          status: "active",
        },
      ],
    };
    expect(GoalsStateSchema.safeParse(validGoals).success).toBe(true);
    expect(validateDomainStoreState("lifeos-goals", validGoals).success).toBe(true);
  });

  it("validates tasks state schema", () => {
    const validTasks = {
      tasks: [
        {
          id: "task-1",
          title: "Buy Groceries",
          status: "todo",
          priority: "med",
          today: true,
          createdAt: "2026-08-23T10:00:00.000Z",
        },
      ],
      dailyFocus: {
        "2026-08-23": ["task-1"],
      },
    };
    expect(TasksStateSchema.safeParse(validTasks).success).toBe(true);
    expect(validateDomainStoreState("lifeos-tasks", validTasks).success).toBe(true);
  });

  it("validates blocks state schema", () => {
    const validBlocks = {
      blocks: [
        { id: "b1", date: "2026-08-23", start: 9, end: 11, title: "Deep Work", color: "#indigo" },
      ],
      view: "day",
      anchor: "2026-08-23",
    };
    expect(BlocksStateSchema.safeParse(validBlocks).success).toBe(true);
    expect(validateDomainStoreState("lifeos-blocks", validBlocks).success).toBe(true);
  });

  it("validates journal state schema", () => {
    const validJournal = {
      entries: [
        { id: "j1", date: "2026-08-23", mood: "great", body: "Productive day!", createdAt: Date.now() },
      ],
    };
    expect(JournalStateSchema.safeParse(validJournal).success).toBe(true);
    expect(validateDomainStoreState("lifeos-journal", validJournal).success).toBe(true);
  });

  it("validates habits state schema", () => {
    const validHabits = {
      habits: [
        {
          id: "h1",
          name: "Morning Walk",
          icon: "footprints",
          targetPerWeek: 7,
          color: "#green",
          log: { "2026-08-23": true },
          createdAt: "2026-08-01",
        },
      ],
    };
    expect(HabitsStateSchema.safeParse(validHabits).success).toBe(true);
    expect(validateDomainStoreState("lifeos-habits", validHabits).success).toBe(true);
  });

  it("validates money state schema", () => {
    const validMoney = {
      currency: "TND",
      accounts: [
        {
          id: "acc1",
          name: "Main Checking",
          type: "bank",
          initialBalance: 5000,
          currency: "TND",
          color: "emerald",
          icon: "landmark",
          createdAt: "2026-08-01",
        },
      ],
      transactions: [
        { id: "tx1", label: "Salary", amount: 3000, tag: "income", date: "2026-08-23", accountId: "acc1" },
        { id: "tx2", label: "Transfer to Savings", amount: 500, tag: "Transfer", date: "2026-08-24", accountId: "acc1", transferAccountId: "acc2" },
      ],
      savings: [
        { id: "sg1", name: "Emergency Fund", current: 5000, target: 10000 },
      ],
    };
    expect(MoneyStateSchema.safeParse(validMoney).success).toBe(true);
    expect(validateDomainStoreState("lifeos-money", validMoney).success).toBe(true);

    // Also validates without accounts field (backward-compatibility default)
    const legacyMoney = {
      currency: "USD",
      transactions: [{ id: "tx1", label: "Income", amount: 100, tag: "Salary", date: "2026-08-01" }],
      savings: [],
    };
    expect(MoneyStateSchema.safeParse(legacyMoney).success).toBe(true);
  });

  it("validates recurring state schema", () => {
    const validRecurring = {
      recurring: [
        {
          id: "rec1",
          title: "Weekly Review",
          rule: { freq: "weekly", weekDays: [6] },
          startDate: "2026-08-01",
          completions: { "2026-08-23": true },
          createdAt: "2026-08-01",
        },
      ],
    };
    expect(RecurringStateSchema.safeParse(validRecurring).success).toBe(true);
    expect(validateDomainStoreState("lifeos-recurring", validRecurring).success).toBe(true);
  });

  it("has validation registered for all 11 active store keys", () => {
    expect(STORE_KEYS).toHaveLength(11);
    for (const key of STORE_KEYS) {
      expect(STORE_STATE_SCHEMAS[key as StoreKey]).toBeDefined();
      const res = validateDomainStoreState(key as StoreKey, {});
      if (res.error) {
        expect(res.error).not.toContain("No validation schema registered");
      }
    }
  });
});
