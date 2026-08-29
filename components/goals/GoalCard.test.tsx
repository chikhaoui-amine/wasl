import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { normalizeGoal, type Goal } from "@/lib/data/domains/goals";
import { GoalCard } from "./GoalCard";

const sampleGoal: Goal = normalizeGoal({
  id: "goal-1",
  title: "Run a Half Marathon",
  why: "Build cardiovascular endurance and discipline",
  type: "yearly_outcome",
  category: "health",
  northStarId: "health",
  targetYear: 2026,
  status: "active",
  isCurrentFocus: true,
  milestones: [
    { id: "m-1", title: "5k without stopping", done: true },
    { id: "m-2", title: "10k weekly long run", done: false },
    { id: "m-3", title: "15k pace test", done: false },
  ],
});

describe("GoalCard", () => {
  it("renders goal title, why statement, North Star, and milestones", () => {
    const html = renderToStaticMarkup(
      <GoalCard
        goal={sampleGoal}
        northStarMeta={{ id: "health", title: "Health & Vitality", color: "#22c55e" }}
        linkedTaskCount={3}
        onOpen={() => undefined}
        onToggleMilestone={() => undefined}
      />,
    );

    expect(html).toContain("Run a Half Marathon");
    expect(html).toContain("Build cardiovascular endurance");
    expect(html).toContain("Health &amp; Vitality");
    expect(html).toContain("5k without stopping");
    expect(html).toContain("10k weekly long run");
    expect(html).toContain("3 tasks");
    expect(html).toContain("1/3");
    expect(html).toContain("33%");
  });

  it("renders focus badge when isCurrentFocus is true", () => {
    const html = renderToStaticMarkup(
      <GoalCard
        goal={sampleGoal}
        onOpen={() => undefined}
        onToggleMilestone={() => undefined}
      />,
    );

    expect(html).toContain("Focus");
  });
});
