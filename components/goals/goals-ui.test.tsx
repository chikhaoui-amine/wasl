import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { normalizeGoal } from "@/lib/data/domains/goals";
import { DirectionNav } from "./DirectionNav";
import { GoalYearPulse } from "./GoalYearPulse";
import { daysLeftLabel, goalPace, yearElapsedPct } from "./pace";

describe("goalPace", () => {
  it("treats goals without a time window as open-ended", () => {
    const pace = goalPace(normalizeGoal({ id: "g", title: "Read more", manualProgress: 20 }));
    expect(pace.tone).toBe("open");
    expect(pace.elapsed).toBeNull();
    expect(pace.progress).toBe(20);
  });

  it("marks completed goals as done", () => {
    const pace = goalPace(normalizeGoal({ id: "g", title: "Ship", completed: true, status: "completed" }));
    expect(pace.tone).toBe("done");
    expect(pace.progress).toBe(100);
  });

  it("flags a goal whose window has fully elapsed with little progress as behind", () => {
    const pace = goalPace(
      normalizeGoal({ id: "g", title: "Old", start: "2000-01-01", end: "2000-12-31", manualProgress: 10 }),
    );
    expect(pace.tone).toBe("behind");
    expect(pace.label).toBe("90% behind pace");
  });
});

describe("pace helpers", () => {
  it("formats days left", () => {
    expect(daysLeftLabel(null)).toBeNull();
    expect(daysLeftLabel(0)).toBe("Due today");
    expect(daysLeftLabel(1)).toBe("1 day left");
    expect(daysLeftLabel(12)).toBe("12 days left");
    expect(daysLeftLabel(120)).toBe("4 months left");
  });

  it("computes year elapsed relative to now", () => {
    const now = new Date(2026, 6, 2);
    expect(yearElapsedPct(2025, now)).toBe(100);
    expect(yearElapsedPct(2027, now)).toBe(0);
    expect(yearElapsedPct(2026, now)).toBe(50);
  });
});

describe("GoalYearPulse", () => {
  it("renders headline progress and stats", () => {
    const html = renderToStaticMarkup(
      <GoalYearPulse
        year={2026}
        yearElapsed={50}
        activeGoalsCount={5}
        averageProgress={64}
        onTrackCount={3}
        behindCount={2}
        completedCount={1}
        completedMilestones={8}
        totalMilestones={12}
      />,
    );
    expect(html).toContain("64");
    expect(html).toContain("Ahead of the calendar by 14%");
    expect(html).toContain("8/12");
    expect(html).toContain("50% of 2026 gone");
  });

  it("handles an empty year", () => {
    const html = renderToStaticMarkup(
      <GoalYearPulse
        year={2026}
        yearElapsed={50}
        activeGoalsCount={0}
        averageProgress={0}
        onTrackCount={0}
        behindCount={0}
        completedCount={0}
        completedMilestones={0}
        totalMilestones={0}
      />,
    );
    expect(html).toContain("Nothing in motion yet");
    expect(html).toContain("0/0");
  });
});

describe("DirectionNav", () => {
  const directions = [
    { id: "health", title: "Health & Vitality", color: "#22c55e", count: 3, progress: 40 },
    { id: "craft", title: "Career & Craft", color: "#3b82f6", count: 0, progress: 0, isUserCreated: true },
  ];

  it("renders directions, edit affordance for own directions, and suggestions", () => {
    const html = renderToStaticMarkup(
      <DirectionNav
        directions={directions}
        selectedId={null}
        totalCount={5}
        suggestions={[
          { id: "finance_wealth", title: "Finance & Wealth", description: "", icon: "Wallet", color: "#5fb36a" },
        ]}
        onSelect={() => undefined}
        onAddDirection={() => undefined}
        onEditDirection={() => undefined}
        onAddSuggestion={() => undefined}
      />,
    );
    expect(html).toContain("All directions");
    expect(html).toContain("Health &amp; Vitality");
    expect(html).toContain("Career &amp; Craft");
    expect(html).toContain("Edit direction Career &amp; Craft");
    expect(html).not.toContain("Edit direction Health");
    expect(html).toContain("Finance &amp; Wealth");
  });

  it("marks the selected direction", () => {
    const html = renderToStaticMarkup(
      <DirectionNav
        directions={directions}
        selectedId="health"
        totalCount={5}
        onSelect={() => undefined}
        onAddDirection={() => undefined}
      />,
    );
    expect(html).toMatch(/aria-current="true"[^>]*>[\s\S]*?Health &amp; Vitality/);
  });
});
