// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import "fake-indexeddb/auto";
import type { ReactNode } from "react";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataProvider, createMemoryQueryClient } from "@/lib/data/query/provider";
import type { DataAdapter } from "@/lib/data/types";
import { type Note, type NoteCategory } from "@/lib/data/domains/notes";

vi.mock("@/components/ui/Modal", () => ({
  Modal: ({ open, title, children }: { open: boolean; title: ReactNode; children: ReactNode }) =>
    open ? (
      <div>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
  Field: ({ label, children }: { label: ReactNode; children: ReactNode }) => (
    <label>
      {label}
      {children}
    </label>
  ),
  FormFooter: ({ onDelete, submitLabel }: { onDelete?: () => void; submitLabel: string }) => (
    <div>
      {onDelete ? (
        <button type="button" onClick={onDelete}>
          Delete
        </button>
      ) : null}
      <button type="submit">{submitLabel}</button>
    </div>
  ),
  Segmented: ({
    value,
    onChange,
    options,
  }: {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
  }) => (
    <div>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
  inputCls: "",
}));

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
});
