import { describe, it, expect } from "vitest";
import { STORE_KEYS } from "./store-registry";
import { STORE_STATE_SCHEMAS } from "./validation/domain-schemas";
import { normalizeBlocksState } from "./domains/blocks/operations";
import { normalizeTrashState } from "./domains/trash/operations";
import { DEFAULT_PROGRAMS } from "../health/default-programs";

/**
 * Schema-drift guards for Local Edition.
 *
 * Ensures runtime shapes match strict Zod validation schemas across all active
 * domain stores so that backups and data persistence remain consistent.
 */

describe("schema drift: validation schemas vs runtime shapes", () => {
  it("has a registered validation schema for every active store key", () => {
    for (const key of STORE_KEYS) {
      expect(STORE_STATE_SCHEMAS[key]).toBeDefined();
    }
  });

  it("validates the runtime trash normalizer output (regression: fictional shape)", () => {
    // Build a realistic trash item exactly the way the app does.
    const rawState = {
      items: [
        {
          id: "trash_1",
          itemType: "task",
          title: "Filed taxes",
          description: "2026 filing",
          itemData: { id: "task_1", title: "Filed taxes", status: "todo", priority: "high", today: false, createdAt: "2026-08-01T00:00:00.000Z" },
          deletedAt: "2026-08-24T12:00:00.000Z",
          originalStoreKey: "lifeos-tasks",
        },
        {
          id: "trash_2",
          itemType: "workout",
          title: "Morning run",
          itemData: { id: "w1", date: "2026-08-23", sport: "Run" },
          deletedAt: new Date().toISOString(),
        },
      ],
    };

    const normalized = normalizeTrashState(rawState);
    expect(normalized.items).toHaveLength(2);

    for (const item of normalized.items) {
      const result = STORE_STATE_SCHEMAS["lifeos-trash"].safeParse({ items: [item] });
      expect(result.success).toBe(true);
    }
  });
});

describe("schema drift: runtime-authored health programs", () => {
  it("default programs always validate against the health domain schema", () => {
    const state = {
      days: {},
      workouts: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      programs: DEFAULT_PROGRAMS as any,
    };
    expect(STORE_STATE_SCHEMAS["lifeos-health"].safeParse(state).success).toBe(true);
  });

  it("program exercises with scalar sets counts validate (legacy MCP shape)", () => {
    const state = {
      days: {},
      workouts: [],
      programs: [
        {
          id: "p1",
          name: "Legacy AI program",
          sessions: [
            {
              id: "s1",
              name: "Day 1",
              exercises: [
                {
                  exerciseId: "ex1",
                  exerciseName: "Bench",
                  targetSets: [{ type: "N", reps: 8, weightKg: 60 }],
                  sets: 3,
                },
              ],
            },
          ],
        },
      ],
    };
    expect(STORE_STATE_SCHEMAS["lifeos-health"].safeParse(state).success).toBe(true);
  });
});

describe("lifeos-blocks schema drift", () => {
  it("accepts the runtime block shape including sync metadata", () => {
    const sample = {
      blocks: [
        {
          id: "b1",
          date: "2026-10-08",
          start: 9.0,
          end: 10.5,
          title: "Team Standup",
          color: "#7c9cf5",
          externalId: "gcal_12345",
          externalProvider: "google" as const,
          updatedAt: "2026-10-08T08:00:00.000Z",
          externalUpdatedAt: "2026-10-08T08:00:00.000Z",
          description: "notes",
        },
      ],
      view: "week" as const,
      anchor: "2026-10-05",
      lastSyncedAt: "2026-10-08T08:00:00.000Z",
      pendingGoogleDeletes: ["gcal_deleted_1"],
    };
    const parsed = STORE_STATE_SCHEMAS["lifeos-blocks"].parse(sample) as unknown as {
      blocks: Array<{ externalUpdatedAt?: string }>;
      pendingGoogleDeletes?: string[];
    };
    expect(parsed.blocks[0].externalUpdatedAt).toBe("2026-10-08T08:00:00.000Z");
    expect(parsed.pendingGoogleDeletes).toEqual(["gcal_deleted_1"]);
    const runtime = normalizeBlocksState(sample);
    expect(runtime.blocks[0].externalUpdatedAt).toBe("2026-10-08T08:00:00.000Z");
    expect(runtime.pendingGoogleDeletes).toEqual(["gcal_deleted_1"]);
  });
});
