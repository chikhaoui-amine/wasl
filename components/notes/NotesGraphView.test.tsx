// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { NotesGraphView } from "./NotesGraphView";
import type { Note, NoteCategory } from "@/lib/data/domains/notes";

const mockCategories: NoteCategory[] = [
  { id: "cat-personal", name: "Personal", color: "#10b981" },
];

const mockNotes: Note[] = [
  { id: "n1", title: "Daily Thoughts", body: "Journal text", tag: "Personal", pinned: false, updatedAt: 1000 },
];

describe("NotesGraphView", () => {
  afterEach(cleanup);

  it("renders empty state when there are no notes", () => {
    const onNewNote = vi.fn();
    render(
      <NotesGraphView
        notes={[]}
        categories={mockCategories}
        onSelectNote={vi.fn()}
        onSelectCategory={vi.fn()}
        onNewNote={onNewNote}
      />
    );

    expect(screen.getByText(/No items in your Knowledge Base yet/i)).toBeTruthy();
    const btn = screen.getByRole("button", { name: /New Item/i });
    fireEvent.click(btn);
    expect(onNewNote).toHaveBeenCalled();
  });

  it("renders canvas and floating controls when notes exist", () => {
    render(
      <NotesGraphView
        notes={mockNotes}
        categories={mockCategories}
        onSelectNote={vi.fn()}
        onSelectCategory={vi.fn()}
        onNewNote={vi.fn()}
      />
    );

    expect(screen.getByTestId("notes-graph-canvas")).toBeTruthy();
    expect(screen.getByTitle("Zoom In")).toBeTruthy();
    expect(screen.getByTitle("Zoom Out")).toBeTruthy();
    expect(screen.getByTitle("Reset Camera")).toBeTruthy();
  });

  it("shows search feedback when query is provided", () => {
    render(
      <NotesGraphView
        notes={mockNotes}
        categories={mockCategories}
        search="nonexistent keyword"
        onSelectNote={vi.fn()}
        onSelectCategory={vi.fn()}
        onNewNote={vi.fn()}
      />
    );

    expect(screen.getByText(/No matching nodes/i)).toBeTruthy();
  });
});
