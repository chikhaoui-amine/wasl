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
  it("renders title, why, direction, next milestone, tasks and progress", () => {
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
    // Only the next open milestone is surfaced, with an overall count.
    expect(html).toContain("Next up");
    expect(html).toContain("10k weekly long run");
    expect(html).not.toContain("5k without stopping");
    expect(html).toContain("1/3");
    expect(html).toContain("3 tasks");
    expect(html).toContain("33%");
  });

  it("hides the direction label when showDirection is false", () => {
    const html = renderToStaticMarkup(
      <GoalCard
        goal={sampleGoal}
        northStarMeta={{ id: "health", title: "Health & Vitality", color: "#22c55e" }}
        showDirection={false}
        onOpen={() => undefined}
        onToggleMilestone={() => undefined}
      />,
    );

    expect(html).not.toContain("Health &amp; Vitality");
  });

  it("renders focus badge when isCurrentFocus is true", () => {
    const html = renderToStaticMarkup(
      <GoalCard goal={sampleGoal} onOpen={() => undefined} onToggleMilestone={() => undefined} />,
    );

    expect(html).toContain("Focus");
  });

  it("offers quick actions only when handlers are provided", () => {
    const without = renderToStaticMarkup(
      <GoalCard goal={sampleGoal} onOpen={() => undefined} onToggleMilestone={() => undefined} />,
    );
    expect(without).not.toContain("Mark goal complete");

    const withActions = renderToStaticMarkup(
      <GoalCard
        goal={sampleGoal}
        onOpen={() => undefined}
        onToggleMilestone={() => undefined}
        onToggleFocus={() => undefined}
        onToggleDone={() => undefined}
      />,
    );
    expect(withActions).toContain("Mark goal complete");
    expect(withActions).toContain("Remove from focus");
  });

  it("shows a completed goal as done at 100%", () => {
    const done = normalizeGoal({ ...sampleGoal, completed: true, status: "completed" });
    const html = renderToStaticMarkup(
      <GoalCard goal={done} onOpen={() => undefined} onToggleMilestone={() => undefined} />,
    );

    expect(html).toContain("100%");
    expect(html).toContain("Completed");
    expect(html).not.toContain("Next up");
  });
});
