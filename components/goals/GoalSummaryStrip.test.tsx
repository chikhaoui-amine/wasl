import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GoalSummaryStrip } from "./GoalSummaryStrip";

describe("GoalSummaryStrip", () => {
  it("renders active goals count, average progress, and milestone velocity", () => {
    const html = renderToStaticMarkup(
      <GoalSummaryStrip
        activeGoalsCount={5}
        averageProgress={64}
        completedMilestones={8}
        totalMilestones={12}
      />,
    );

    expect(html).toContain("5");
    expect(html).toContain("Active Goals");
    expect(html).toContain("64%");
    expect(html).toContain("Avg Completion");
    expect(html).toContain("8 / 12");
    expect(html).toContain("Milestones Done");
  });

  it("handles zero goals gracefully", () => {
    const html = renderToStaticMarkup(
      <GoalSummaryStrip
        activeGoalsCount={0}
        averageProgress={0}
        completedMilestones={0}
        totalMilestones={0}
      />,
    );

    expect(html).toContain("0");
    expect(html).toContain("Active Goals");
    expect(html).toContain("0%");
    expect(html).toContain("0 / 0");
  });
});
