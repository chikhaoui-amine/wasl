import { describe, expect, it } from "vitest";
import type { Task } from "@/lib/data/domains/tasks";
import type { Habit } from "@/lib/data/domains/habits";
import type { Block } from "@/lib/data/domains/blocks";
import { daySummaryPhrases, formatHour, summarizeDay } from "./DaySummary";

const D = "2026-10-10";
const task = (p: Partial<Task>) => ({ id: Math.random().toString(), title: "t", status: "todo", priority: "med", ...p }) as Task;
const habit = (log: Record<string, boolean>) => ({ id: Math.random().toString(), name: "h", log }) as unknown as Habit;
const block = (start: number, end: number, title: string) => ({ id: title, date: D, start, end, title, color: "#fff" }) as Block;

describe("summarizeDay", () => {
  it("counts today's open tasks, overdue tasks and remaining habits", () => {
    const s = summarizeDay(
      [
        task({ today: true }),
        task({ due: D }),
        task({ due: "2026-10-01" }),
        task({ due: D, status: "done" }),
        task({ due: "2026-10-20" }),
      ],
      [habit({ [D]: true }), habit({})],
      [],
      D,
      9,
    );
    expect(s.tasksLeft).toBe(2);
    expect(s.overdue).toBe(1);
    expect(s.habitsLeft).toBe(1);
    expect(s.habitsTotal).toBe(2);
    expect(s.nextBlock).toBeNull();
  });

  it("prefers the block happening now, then the next one", () => {
    const blocks = [block(14, 16, "Study"), block(9, 11.5, "Deep work")];
    expect(summarizeDay([], [], blocks, D, 10).nextBlock).toEqual({ title: "Deep work", start: 9, now: true });
    expect(summarizeDay([], [], blocks, D, 12).nextBlock).toEqual({ title: "Study", start: 14, now: false });
    expect(summarizeDay([], [], blocks, D, 17).nextBlock).toBeNull();
  });
});

describe("daySummaryPhrases", () => {
  it("builds readable phrases", () => {
    expect(
      daySummaryPhrases({
        tasksLeft: 1,
        overdue: 2,
        habitsLeft: 0,
        habitsTotal: 3,
        nextBlock: { title: "Run", start: 7.5, now: false },
      }),
    ).toEqual(["1 task left", "2 overdue", "All habits done", "Next: Run at 7:30"]);
  });

  it("falls back to a clear-day message", () => {
    expect(daySummaryPhrases({ tasksLeft: 0, overdue: 0, habitsLeft: 0, habitsTotal: 0, nextBlock: null })).toEqual([
      "Nothing scheduled. A clear day.",
    ]);
  });

  it("formats decimal hours", () => {
    expect(formatHour(9)).toBe("9:00");
    expect(formatHour(14.25)).toBe("14:15");
  });
});
