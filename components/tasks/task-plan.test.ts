import { describe, expect, it } from "vitest";
import type { Task } from "@/lib/data/domains/tasks";
import { buildTaskPlan, parseQuickAdd, planBucket } from "./task-plan";

const TODAY = "2026-10-07"; // Wednesday
const WEEK = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"];
const task = (p: Partial<Task>): Task => ({
  id: p.title ?? Math.random().toString(),
  title: "t",
  status: "todo",
  priority: "med",
  today: false,
  createdAt: "2026-10-01",
  ...p,
});

describe("planBucket", () => {
  const end = WEEK[6];
  it("places every open task in exactly one bucket", () => {
    expect(planBucket(task({ due: "2026-10-01" }), TODAY, end)).toBe("overdue");
    expect(planBucket(task({ today: true }), TODAY, end)).toBe("today");
    expect(planBucket(task({ due: TODAY }), TODAY, end)).toBe("today");
    expect(planBucket(task({ due: "2026-10-09" }), TODAY, end)).toBe("week");
    expect(planBucket(task({ weekly: true }), TODAY, end)).toBe("week");
    expect(planBucket(task({ due: "2026-11-02" }), TODAY, end)).toBe("later");
    expect(planBucket(task({}), TODAY, end)).toBe("someday");
    expect(planBucket(task({ status: "done" }), TODAY, end)).toBe("done");
  });

  it("an overdue weekly task is overdue, not week", () => {
    expect(planBucket(task({ weekly: true, due: "2026-10-06" }), TODAY, end)).toBe("overdue");
  });
});

describe("buildTaskPlan", () => {
  it("groups the week by remaining days and keeps undated weekly tasks apart", () => {
    const plan = buildTaskPlan(
      [
        task({ title: "fri", due: "2026-10-09" }),
        task({ title: "anytime", weekly: true }),
        task({ title: "later", due: "2026-12-01" }),
        task({ title: "someday" }),
        task({ title: "done-today", status: "done", completedAt: TODAY }),
        task({ title: "done-old", status: "done", completedAt: "2026-09-01" }),
      ],
      TODAY,
      WEEK,
    );
    expect(plan.week.map((d) => d.day)).toEqual(["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
    expect(plan.week.find((d) => d.day === "2026-10-09")?.tasks.map((t) => t.title)).toEqual(["fri"]);
    expect(plan.weekAnytime.map((t) => t.title)).toEqual(["anytime"]);
    expect(plan.later.map((t) => t.title)).toEqual(["later"]);
    expect(plan.someday.map((t) => t.title)).toEqual(["someday"]);
    expect(plan.doneToday.map((t) => t.title)).toEqual(["done-today"]);
  });

  it("sorts today's tasks by priority", () => {
    const plan = buildTaskPlan(
      [task({ title: "low", today: true, priority: "low" }), task({ title: "high", today: true, priority: "high" })],
      TODAY,
      WEEK,
    );
    expect(plan.today.map((t) => t.title)).toEqual(["high", "low"]);
  });
});

describe("parseQuickAdd", () => {
  it("reads priority markers and strips them", () => {
    expect(parseQuickAdd("Call the bank !")).toEqual({ title: "Call the bank", priority: "high" });
    expect(parseQuickAdd("!high Pay rent")).toEqual({ title: "Pay rent", priority: "high" });
    expect(parseQuickAdd("Water plants !low")).toEqual({ title: "Water plants", priority: "low" });
    expect(parseQuickAdd("  Read chapter 3  ")).toEqual({ title: "Read chapter 3", priority: "med" });
  });

  it("leaves exclamation marks inside words alone", () => {
    expect(parseQuickAdd("Ship v2!")).toEqual({ title: "Ship v2!", priority: "med" });
  });
});
