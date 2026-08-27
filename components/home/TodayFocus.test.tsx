import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Task } from "@/lib/data/domains/tasks";
import { TodayFocusCard } from "./TodayFocus";

const tasks: Task[] = [
  {
    id: "open-task",
    title: "Finish python + git",
    status: "todo",
    priority: "high",
    due: "2026-08-18",
    today: true,
    createdAt: "2026-08-18",
  },
  {
    id: "done-task",
    title: "Finish davinci basics",
    status: "done",
    priority: "med",
    due: "2026-08-18",
    today: true,
    createdAt: "2026-08-18",
    completedAt: "2026-08-18",
  },
];

const renderCard = (ready = true, taskList = tasks) =>
  renderToStaticMarkup(
    <TodayFocusCard
      ready={ready}
      tasks={taskList}
      goals={[]}
      onToggleTask={() => undefined}
      onEditTask={() => undefined}
      onAddTask={() => undefined}
    />,
  );

describe("TodayFocusCard", () => {
  it("renders today tasks and shows done counter", () => {
    const html = renderCard();

    expect(html).toContain("Today’s Tasks");
    expect(html).toContain("Finish python + git");
    expect(html).toContain("Finish davinci basics");
    expect(html).toContain("1/2 done");
    expect(html).toContain("All tasks");
  });

  it("renders empty state when no tasks scheduled for today", () => {
    const html = renderCard(true, []);

    expect(html).toContain("No tasks scheduled for today.");
    expect(html).toContain("Add task");
  });

  it("shows loading state when not ready", () => {
    const html = renderCard(false);

    expect(html).toContain("Preparing today’s tasks…");
    expect(html).not.toContain("Finish python + git");
  });
});
