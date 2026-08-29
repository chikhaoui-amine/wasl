import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Habit } from "@/lib/data/domains/habits";
import { HabitsWidgetCard } from "./HabitsWidget";

const habits: Habit[] = [
  {
    id: "habit-1",
    name: "Morning Walk",
    icon: "activity",
    targetPerWeek: 7,
    color: "#22c55e",
    createdAt: "2026-08-20",
    log: {
      "2026-08-29": true,
    },
  },
  {
    id: "habit-2",
    name: "Read Book",
    icon: "book-open",
    targetPerWeek: 5,
    color: "#3b82f6",
    createdAt: "2026-08-20",
    log: {
      "2026-08-28": true,
    },
  },
];

const renderCard = (ready = true, habitList = habits, today = "2026-08-29") =>
  renderToStaticMarkup(
    <HabitsWidgetCard
      ready={ready}
      habits={habitList}
      today={today}
      onToggleDay={() => undefined}
    />,
  );

describe("HabitsWidgetCard", () => {
  it("renders today habits and shows correct done counter", () => {
    const html = renderCard();

    expect(html).toContain("Habits Today");
    expect(html).toContain("Morning Walk");
    expect(html).toContain("Read Book");
    expect(html).toContain("1/2 done");
    expect(html).toContain("All habits");
  });

  it("marks completed habits with done styles and mark incomplete label", () => {
    const html = renderCard();

    // Morning Walk is done on 2026-08-29
    expect(html).toContain("Morning Walk");
    expect(html).toContain("aria-label=\"Morning Walk: mark incomplete\"");
    expect(html).toContain("title=\"Mark incomplete\"");

    // Read Book is NOT done on 2026-08-29
    expect(html).toContain("Read Book");
    expect(html).toContain("aria-label=\"Read Book: mark complete for today\"");
    expect(html).toContain("title=\"Mark complete for today\"");
  });

  it("renders empty state when no habits tracked", () => {
    const html = renderCard(true, []);

    expect(html).toContain("No habits tracked yet.");
    expect(html).toContain("Create first habit");
  });

  it("shows loading state when not ready", () => {
    const html = renderCard(false);

    expect(html).toContain("Preparing habits…");
    expect(html).not.toContain("Morning Walk");
  });
});
