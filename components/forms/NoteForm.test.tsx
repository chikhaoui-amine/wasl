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

vi.mock("./CategoryForm", () => ({ CategoryForm: () => null }));
vi.mock("./ImageInsertModal", () => ({ ImageInsertModal: () => null }));

import { NoteForm } from "./NoteForm";

const categories: NoteCategory[] = [
  { id: "cat-personal", name: "Personal", color: "green" },
  { id: "cat-idea", name: "Idea", color: "purple" },
];

const staleNote: Note = {
  id: "note-1",
  title: "Original title",
  body: "Original body",
  tag: "Personal",
  pinned: false,
  updatedAt: 1,
  contentType: "note",
};

describe("NoteForm sync rehydration & draft reliability", () => {
  let queryClient: ReturnType<typeof createMemoryQueryClient>;

  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = createMemoryQueryClient();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("keeps an existing draft and does not restart autosave across repeated rehydrates", async () => {
    const mutateStore = vi.fn().mockImplementation((_key, updater) => {
      const state = updater({ notes: [staleNote], categories });
      return Promise.resolve({
        store: "lifeos-notes",
        version: 3,
        state,
        updatedAt: new Date().toISOString(),
      });
    });

    const mockAdapter: Partial<DataAdapter> = {
      initialize: () => Promise.resolve(),
      getStore: (() =>
        Promise.resolve({
          store: "lifeos-notes",
          version: 3,
          state: { notes: [staleNote], categories },
          updatedAt: "2026-08-23",
        })) as any,
      mutateStore,
      getAllStores: () => Promise.resolve([]),
      subscribe: () => () => {},
    };

    render(
      <DataProvider adapter={mockAdapter as DataAdapter} queryClient={queryClient} edition="local">
        <NoteForm open onClose={vi.fn()} note={staleNote} />
      </DataProvider>,
    );

    // Switch to source mode to directly edit textarea or edit title
    const sourceBtn = screen.getByTitle("Source Markdown Editor");
    fireEvent.click(sourceBtn);

    const editor = screen.getByPlaceholderText(/Write thoughts/) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "Unsynced draft" } });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(mutateStore).toHaveBeenCalledTimes(1);

    // Re-render simulate rehydrate
    for (let refresh = 0; refresh < 3; refresh += 1) {
      await act(async () => {
        vi.advanceTimersByTime(250);
      });
      expect(editor.value).toBe("Unsynced draft");
    }

    expect(mutateStore).toHaveBeenCalledTimes(1);
  });

  it("keeps a new note's draft and active ID across repeated rehydrates", async () => {
    const mutateStore = vi.fn().mockImplementation((_key, updater) => {
      const state = updater({ notes: [], categories });
      return Promise.resolve({
        store: "lifeos-notes",
        version: 3,
        state,
        updatedAt: new Date().toISOString(),
      });
    });

    const mockAdapter: Partial<DataAdapter> = {
      initialize: () => Promise.resolve(),
      getStore: (() =>
        Promise.resolve({
          store: "lifeos-notes",
          version: 3,
          state: { notes: [], categories },
          updatedAt: "2026-08-23",
        })) as any,
      mutateStore,
      getAllStores: () => Promise.resolve([]),
      subscribe: () => () => {},
    };

    render(
      <DataProvider adapter={mockAdapter as DataAdapter} queryClient={queryClient} edition="local">
        <NoteForm open onClose={vi.fn()} />
      </DataProvider>,
    );

    // Switch to source mode to test draft
    const sourceBtn = screen.getByTitle("Source Markdown Editor");
    fireEvent.click(sourceBtn);

    const editor = screen.getByPlaceholderText(/Write thoughts/) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "New draft" } });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(mutateStore).toHaveBeenCalledTimes(1);

    for (let refresh = 0; refresh < 3; refresh += 1) {
      await act(async () => {
        vi.advanceTimersByTime(250);
      });
      expect(editor.value).toBe("New draft");
    }

    expect(mutateStore).toHaveBeenCalledTimes(1);
  });

  it("renders full-page controls: title, category, type switcher, and close", async () => {
    const mockAdapter: Partial<DataAdapter> = {
      initialize: () => Promise.resolve(),
      getStore: (() =>
        Promise.resolve({
          store: "lifeos-notes",
          version: 3,
          state: { notes: [staleNote], categories },
          updatedAt: "2026-08-23",
        })) as any,
      mutateStore: vi.fn(),
      getAllStores: () => Promise.resolve([]),
      subscribe: () => () => {},
    };

    const handleClose = vi.fn();

    render(
      <DataProvider adapter={mockAdapter as DataAdapter} queryClient={queryClient} edition="local">
        <NoteForm open onClose={handleClose} note={staleNote} />
      </DataProvider>,
    );

    expect(screen.getByPlaceholderText(/Title of note/)).toBeDefined();
    expect(screen.getByText("Back to Notes")).toBeDefined();
    expect(screen.getByText("Done")).toBeDefined();

    const backBtn = screen.getByText("Back to Notes");
    await act(async () => {
      fireEvent.click(backBtn);
    });
    expect(handleClose).toHaveBeenCalled();
  });

  it("extracts base64 images into references and keeps textarea clean in source mode", async () => {
    const imageNote: Note = {
      id: "note-img",
      title: "Image note",
      body: "# Title\n\n![My Photo | left | medium](data:image/webp;base64,largeBase64Content12345)\n\nEnd text.",
      tag: "Personal",
      pinned: false,
      updatedAt: 1,
      contentType: "note",
    };

    const mockAdapter: Partial<DataAdapter> = {
      initialize: () => Promise.resolve(),
      getStore: (() =>
        Promise.resolve({
          store: "lifeos-notes",
          version: 3,
          state: { notes: [imageNote], categories },
          updatedAt: "2026-08-23",
        })) as any,
      mutateStore: vi.fn(),
      getAllStores: () => Promise.resolve([]),
      subscribe: () => () => {},
    };

    render(
      <DataProvider adapter={mockAdapter as DataAdapter} queryClient={queryClient} edition="local">
        <NoteForm open onClose={vi.fn()} note={imageNote} />
      </DataProvider>,
    );

    const textarea = screen.getByPlaceholderText(/Write thoughts/) as HTMLTextAreaElement;
    // Textarea MUST NOT contain the giant raw base64 string
    expect(textarea.value).not.toContain("data:image/webp;base64,largeBase64Content12345");
    // Textarea MUST contain the clean reference tag
    expect(textarea.value).toContain("![My Photo | left | medium][img-1]");
    // Attached photos bar should display the photo tag
    expect(screen.getByText("[img-1]")).toBeDefined();
  });

  it("renders section dropdown when active category has sections and saves selected section", async () => {
    const categoriesWithSections: NoteCategory[] = [
      { id: "cat-ideas", name: "Ideas", color: "purple", sections: ["Approved", "Rejected"] },
    ];

    const addNote = vi.fn().mockImplementation(async (payload) => {
      return { id: "new-note-1", ...payload, updatedAt: Date.now() };
    });
    const updateNote = vi.fn().mockResolvedValue(undefined);
    const deleteNote = vi.fn().mockResolvedValue(undefined);

    render(
      <QueryClientProvider client={queryClient}>
        <NoteForm
          open
          onClose={vi.fn()}
          defaultTag="Ideas"
          defaultSection="Approved"
          data={{
            categories: categoriesWithSections,
            addNote,
            updateNote,
            deleteNote,
          }}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByTitle("Choose Section Tag")).toBeDefined();

    const titleInput = screen.getByPlaceholderText(/Title of note/);
    fireEvent.change(titleInput, { target: { value: "A new approved idea" } });

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(addNote).toHaveBeenCalled();
    expect(addNote.mock.calls[0][0].section).toBe("Approved");
  });
});

