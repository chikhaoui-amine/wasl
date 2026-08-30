import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NorthStarFilterStrip } from "./NorthStarFilterStrip";

const sampleNorthStars = [
  {
    id: "health",
    title: "Health & Vitality",
    description: "Peak physical and mental energy every single day.",
    color: "#22c55e",
    count: 3,
    isUserCreated: false,
  },
  {
    id: "career",
    title: "Career & Craft",
    description: "Mastery and building enduring systems.",
    color: "#3b82f6",
    count: 2,
    isUserCreated: true,
  },
  {
    id: "finance",
    title: "Finance & Wealth",
    description: "Financial independence.",
    color: "#eab308",
    count: 0,
    isUserCreated: false,
  },
];

describe("NorthStarFilterStrip", () => {
  it("renders All Directions and category chips with counts only when count > 0", () => {
    const html = renderToStaticMarkup(
      <NorthStarFilterStrip
        northStars={sampleNorthStars}
        selectedId={null}
        totalGoalsCount={5}
        onSelect={() => undefined}
        onAddNorthStar={() => undefined}
      />,
    );

    expect(html).toContain("All Directions");
    expect(html).toContain("5");
    expect(html).toContain("Health &amp; Vitality");
    expect(html).toContain("3");
    expect(html).toContain("Career &amp; Craft");
    expect(html).toContain("2");
    expect(html).toContain("Finance &amp; Wealth");
    // Verify that "0" badge is suppressed
    expect(html).not.toMatch(/<span[^>]*tabular-nums[^>]*>\s*0\s*<\/span>/);
    expect(html).toContain("Add Direction");
    expect(html).not.toContain("+ + Add Direction");
  });

  it("renders selected North Star chip with active styling", () => {
    const html = renderToStaticMarkup(
      <NorthStarFilterStrip
        northStars={sampleNorthStars}
        selectedId="health"
        totalGoalsCount={5}
        onSelect={() => undefined}
        onAddNorthStar={() => undefined}
      />,
    );

    expect(html).toContain("Health &amp; Vitality");
  });
});

