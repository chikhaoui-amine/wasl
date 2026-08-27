import { describe, expect, it } from "vitest";
import type { Task } from "@/lib/data/domains/tasks";
import {
  ensureDailyFocus,
  rankFocusCandidates,
  removeTaskFromDailyFocus,
  setDailyFocusSlot,
  suggestDailyFocusIds,
} from "./focus";

const task = (id: string, patch: Partial<Task> = {}): Task => ({
  id,
  title: id,
  status: "todo",
  priority: "low",
  today: false,
  createdAt: "2026-08-01",
  ...patch,
});

describe("rankFocusCandidates", () => {
  it("orders open work by urgency and stable tie-breakers", () => {
    const tasks = [
      task("remaining"),
      task("today-flag", { today: true }),
      task("high-later", { priority: "high", due: "2026-08-20" }),
      task("high-undated", { priority: "high" }),
      task("due-med", { due: "2026-08-06", priority: "med" }),
      task("due-high", { due: "2026-08-06", priority: "high" }),
      task("old-overdue-low", { due: "2026-08-01", priority: "low" }),
      task("old-overdue-high", { due: "2026-08-01", priority: "high" }),
      task("new-overdue", { due: "2026-08-05", priority: "high" }),
      task("done", { status: "done", due: "2026-08-01" }),
    ];

    expect(rankFocusCandidates(tasks, "2026-08-06").map((item) => item.id)).toEqual([
      "old-overdue-high",
      "old-overdue-low",
      "new-overdue",
      "due-high",
      "due-med",
      "high-later",
      "high-undated",
      "today-flag",
      "remaining",
    ]);
  });

  it("uses creation date and ID as stable final tie-breakers", () => {
    const tasks = [
      task("later", { createdAt: "2026-08-03" }),
      task("b", { createdAt: "2026-08-02" }),
      task("a", { createdAt: "2026-08-02" }),
    ];

    expect(rankFocusCandidates(tasks, "2026-08-06").map((item) => item.id)).toEqual([
      "a",
      "b",
      "later",
    ]);
  });

  it("returns at most three unique suggested open-task IDs", () => {
    const tasks = [task("a"), task("b"), task("c"), task("d")];

    expect(suggestDailyFocusIds(tasks, "2026-08-06")).toEqual(["a", "b", "c"]);
  });

  it("returns every eligible task when fewer than three are open", () => {
    const tasks = [task("a"), task("done", { status: "done" })];

    expect(suggestDailyFocusIds(tasks, "2026-08-06")).toEqual(["a"]);
  });
});

describe("daily focus map", () => {
  it("initializes a missing date from ranked suggestions", () => {
    const result = ensureDailyFocus(
      {},
      [task("later"), task("urgent", { due: "2026-08-01" })],
      "2026-08-06",
    );

    expect(result).toEqual({ "2026-08-06": ["urgent", "later"] });
  });

  it("does not regenerate an existing intentionally empty date", () => {
    const original = { "2026-08-06": [] };

    expect(
      ensureDailyFocus(original, [task("urgent", { due: "2026-08-01" })], "2026-08-06"),
    ).toBe(original);
  });

  it("replaces one slot without changing the others", () => {
    expect(
      setDailyFocusSlot({ "2026-08-06": ["a", "b", "c"] }, "2026-08-06", 1, "d"),
    ).toEqual({ "2026-08-06": ["a", "d", "c"] });
  });

  it("moves an already-selected task instead of duplicating it", () => {
    expect(
      setDailyFocusSlot({ "2026-08-06": ["a", "b", "c"] }, "2026-08-06", 0, "c"),
    ).toEqual({ "2026-08-06": ["c", "b"] });
  });

  it("appends only at the next available slot and caps focus at three", () => {
    const date = "2026-08-06";
    const first = setDailyFocusSlot({ [date]: ["a"] }, date, 2, "b");
    const full = setDailyFocusSlot(first, date, 2, "c");
    const capped = setDailyFocusSlot(full, date, 3, "d");

    expect(first[date]).toEqual(["a", "b"]);
    expect(full[date]).toEqual(["a", "b", "c"]);
    expect(capped[date]).toEqual(["a", "b", "c"]);
  });

  it("removes a deleted task from every date while retaining date keys", () => {
    expect(
      removeTaskFromDailyFocus(
        { "2026-08-06": ["a", "b"], "2026-08-05": ["b"] },
        "b",
      ),
    ).toEqual({ "2026-08-06": ["a"], "2026-08-05": [] });
  });
});
