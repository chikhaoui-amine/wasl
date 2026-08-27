// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NorthStarCard } from "@/components/goals/NorthStarCard";
import type { NorthStarPreset } from "@/lib/data/domains/goals";

afterEach(cleanup);

describe("NorthStarCard", () => {
  const mockPreset: NorthStarPreset & { isUserCreated?: boolean } = {
    id: "health_fitness",
    title: "Health & Fitness",
    description: "Physical vitality, conditioning & well-being",
    icon: "Activity",
    color: "#37c9b7",
    isUserCreated: true,
  };

  it("renders title, description, active count, and handles actions", () => {
    const onAddGoal = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <NorthStarCard
        preset={mockPreset}
        activeCount={2}
        onAddGoal={onAddGoal}
        onEdit={onEdit}
        onDelete={onDelete}
      >
        <div>Nested Goal 1</div>
      </NorthStarCard>,
    );

    expect(screen.getByText("Health & Fitness")).toBeDefined();
    expect(screen.getByText("Physical vitality, conditioning & well-being")).toBeDefined();
    expect(screen.getByText("2 goals")).toBeDefined();
    expect(screen.getByText("Nested Goal 1")).toBeDefined();

    // Trigger Add Goal
    const addBtn = screen.getByTitle("Add goal to Health & Fitness");
    fireEvent.click(addBtn);
    expect(onAddGoal).toHaveBeenCalledTimes(1);

    // Trigger Edit
    const editBtn = screen.getByTitle("Edit North Star");
    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledTimes(1);

    // Trigger Delete
    const deleteBtn = screen.getByTitle("Delete North Star");
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("omits edit/delete buttons when callbacks are not provided", () => {
    render(
      <NorthStarCard
        preset={{ ...mockPreset, isUserCreated: false }}
        activeCount={0}
      >
        <div>Empty</div>
      </NorthStarCard>,
    );

    expect(screen.queryByTitle("Edit North Star")).toBeNull();
    expect(screen.queryByTitle("Delete North Star")).toBeNull();
    expect(screen.getByText("0 goals")).toBeDefined();
  });
});
