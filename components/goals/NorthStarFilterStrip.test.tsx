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
];

describe("NorthStarFilterStrip", () => {
  it("renders All Goals chip and individual North Star filter chips", () => {
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
    expect(html).toContain("+ Add Direction");
  });

  it("shows vision description when a North Star is selected", () => {
    const html = renderToStaticMarkup(
      <NorthStarFilterStrip
        northStars={sampleNorthStars}
        selectedId="health"
        totalGoalsCount={5}
        onSelect={() => undefined}
        onAddNorthStar={() => undefined}
      />,
    );

    expect(html).toContain("Peak physical and mental energy every single day.");
  });
});
