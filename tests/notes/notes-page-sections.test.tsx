// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import "fake-indexeddb/auto";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { DataProvider, createMemoryQueryClient } from "@/lib/data/query/provider";
import type { DataAdapter } from "@/lib/data/types";
import { type Note, type NoteCategory } from "@/lib/data/domains/notes";

vi.mock("@/components/ui/MarkdownRenderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div>{content}</div>,
  isRtlText: () => false,
}));

vi.mock("@/components/forms/NoteForm", () => ({
  NoteForm: ({ open, defaultSection }: any) =>
    open ? <div data-testid="note-form-modal">NoteFormModal-{defaultSection || "none"}</div> : null,
}));
vi.mock("@/components/forms/CategoryForm", () => ({ CategoryForm: () => null }));
vi.mock("@/components/details/NoteDetail", () => ({ NoteDetail: () => null }));
vi.mock("@/components/notes/NotesGraphView", () => ({ NotesGraphView: () => <div data-testid="graph-view" /> }));
vi.mock("@/components/notes/NoteSplitView", () => ({ NoteSplitView: () => <div data-testid="split-view" /> }));
vi.mock("@/components/notes/NoteListView", () => ({ NoteListView: () => <div data-testid="list-view" /> }));

import NotesPage from "@/app/notes/page";

const testCategories: NoteCategory[] = [
  { id: "cat-ideas", name: "Ideas", color: "purple", sections: ["Approved", "Rejected"] },
  { id: "cat-general", name: "General", color: "blue" },
];

const testNotes: Note[] = [
  {
    id: "note-1",
    title: "Approved Idea",
    body: "Body 1",
    tag: "Ideas",
    section: "Approved",
    pinned: false,
    updatedAt: 1000,
  },
  {
    id: "note-2",
    title: "Rejected Idea",
    body: "Body 2",
    tag: "Ideas",
    section: "Rejected",
    pinned: false,
    updatedAt: 2000,
  },
  {
    id: "note-3",
    title: "Unsorted Idea",
    body: "Body 3",
    tag: "Ideas",
    pinned: false,
    updatedAt: 3000,
  },
];

describe("NotesPage Sections & Drag-and-Drop", () => {
  let queryClient: ReturnType<typeof createMemoryQueryClient>;
  let mutateStore: ReturnType<typeof vi.fn>;
  let currentState: { notes: Note[]; categories: NoteCategory[] };

  beforeEach(() => {
    queryClient = createMemoryQueryClient();
    currentState = {
      notes: [...testNotes],
      categories: [...testCategories],
    };
    mutateStore = vi.fn().mockImplementation((_key, updater) => {
      currentState = updater(currentState);
      return Promise.resolve({
        store: "lifeos-notes",
        version: 3,
        state: currentState,
        updatedAt: new Date().toISOString(),
      });
    });
  });

  afterEach(() => {
    cleanup();
  });

  const renderPage = (adapter: Partial<DataAdapter>) => {
    return render(
      <DataProvider adapter={adapter as DataAdapter} queryClient={queryClient} edition="local">
        <QueryClientProvider client={queryClient}>
          <NotesPage />
        </QueryClientProvider>
      </DataProvider>,
    );
  };

  it("renders vertical stacked sections for categories with custom sections", async () => {
    const mockAdapter: Partial<DataAdapter> = {
      initialize: () => Promise.resolve(),
      getStore: () =>
        Promise.resolve({
          store: "lifeos-notes",
          version: 3,
          state: currentState,
          updatedAt: "2026-09-05",
        }) as any,
      mutateStore: mutateStore as any,
      getAllStores: () => Promise.resolve([]),
      subscribe: () => () => {},
    };

    renderPage(mockAdapter);

    // Initial view is All Pages (Graph View)
    expect(screen.getByTestId("graph-view")).toBeDefined();

    // Click on "Ideas" category tab
    const ideasTab = await screen.findByRole("button", { name: /Ideas/ });
    await act(async () => {
      fireEvent.click(ideasTab);
    });

    // Check vertical stacked section headers
    expect(screen.getAllByText("Inbox / Unsorted").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Approved").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Rejected").length).toBeGreaterThanOrEqual(1);

    // Check notes are placed in their sections
    expect(screen.getByText("Approved Idea")).toBeDefined();
    expect(screen.getByText("Rejected Idea")).toBeDefined();
    expect(screen.getByText("Unsorted Idea")).toBeDefined();
  });

  it("updates note section via the card status pill dropdown", async () => {
    const mockAdapter: Partial<DataAdapter> = {
      initialize: () => Promise.resolve(),
      getStore: () =>
        Promise.resolve({
          store: "lifeos-notes",
          version: 3,
          state: currentState,
          updatedAt: "2026-09-05",
        }) as any,
      mutateStore: mutateStore as any,
      getAllStores: () => Promise.resolve([]),
      subscribe: () => () => {},
    };

    renderPage(mockAdapter);

    // Switch to "Ideas"
    const ideasTab = await screen.findByRole("button", { name: /Ideas/ });
    await act(async () => {
      fireEvent.click(ideasTab);
    });

    // Find the status pill select for "Unsorted Idea"
    const unsortedSelect = screen.getByLabelText("Change section for Unsorted Idea") as HTMLSelectElement;
    expect(unsortedSelect.value).toBe("");

    // Change section to "Approved"
    await act(async () => {
      fireEvent.change(unsortedSelect, { target: { value: "Approved" } });
    });

    expect(mutateStore).toHaveBeenCalled();
    const updatedNote = currentState.notes.find((n) => n.id === "note-3");
    expect(updatedNote?.section).toBe("Approved");
  });

  it("moves note section via drag and drop between section dropzones", async () => {
    const mockAdapter: Partial<DataAdapter> = {
      initialize: () => Promise.resolve(),
      getStore: () =>
        Promise.resolve({
          store: "lifeos-notes",
          version: 3,
          state: currentState,
          updatedAt: "2026-09-05",
        }) as any,
      mutateStore: mutateStore as any,
      getAllStores: () => Promise.resolve([]),
      subscribe: () => () => {},
    };

    renderPage(mockAdapter);

    // Switch to "Ideas"
    const ideasTab = await screen.findByRole("button", { name: /Ideas/ });
    await act(async () => {
      fireEvent.click(ideasTab);
    });

    const noteCard = screen.getByText("Approved Idea").closest("article")!;
    expect(noteCard.getAttribute("draggable")).toBe("true");

    const dataStore: Record<string, string> = {};
    const mockDataTransfer = {
      setData: vi.fn((format: string, data: string) => {
        dataStore[format] = data;
      }),
      getData: vi.fn((format: string) => dataStore[format] || ""),
      effectAllowed: "none",
      dropEffect: "none",
    };

    // Drag start on Approved Idea
    fireEvent.dragStart(noteCard, { dataTransfer: mockDataTransfer });
    expect(mockDataTransfer.setData).toHaveBeenCalledWith("application/x-wasl-note-id", "note-1");

    // Drop onto Rejected dropzone
    const rejectedElements = screen.getAllByText("Rejected");
    const rejectedHeader = rejectedElements.find((el) => el.tagName.toLowerCase() === "span" && el.closest("section"));
    const rejectedContainer = rejectedHeader!.closest("section")!.querySelector("div[class*='min-h-']")!;

    fireEvent.dragOver(rejectedContainer, { dataTransfer: mockDataTransfer });
    await act(async () => {
      fireEvent.drop(rejectedContainer, { dataTransfer: mockDataTransfer });
    });

    expect(mutateStore).toHaveBeenCalled();
    const movedNote = currentState.notes.find((n) => n.id === "note-1");
    expect(movedNote?.section).toBe("Rejected");
  });
});
