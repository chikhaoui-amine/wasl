// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";

const { testLocalStorage } = vi.hoisted(() => {
  const storageValues = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return storageValues.size;
    },
    clear: () => storageValues.clear(),
    getItem: (key) => storageValues.get(key) ?? null,
    key: (index) => [...storageValues.keys()][index] ?? null,
    removeItem: (key) => {
      storageValues.delete(key);
    },
    setItem: (key, value) => {
      storageValues.set(key, value);
    },
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  return { testLocalStorage: storage };
});

import { LocalAdapter } from "../../adapters/local/local-adapter";
import { DataProvider, createMemoryQueryClient } from "../../query/provider";
import { useNotesData } from "./hooks";
import { CoalescingSaveQueue } from "./save-queue";
import {
  createDefaultNotesState,
  addNoteOperation,
  updateNoteOperation,
  togglePinOperation,
  deleteNoteOperation,
  addCategoryOperation,
  updateCategoryOperation,
  deleteCategoryOperation,
  relTime,
  DEFAULT_CATEGORIES,
  type Note,
  type NoteCategory,
} from "./operations";
import type { NotesPersistedState } from "../../types";
import { migrateNotesSnapshot, CURRENT_NOTES_VERSION } from "./migrations";

describe("Notes Domain — Pure Operations", () => {
  it("creates clean default state with default categories and sample notes", () => {
    const state = createDefaultNotesState();
    expect(state.notes.length).toBeGreaterThan(0);
    expect(state.categories).toEqual(DEFAULT_CATEGORIES);
  });

  it("formats relative time correctly", () => {
    const now = Date.now();
    expect(relTime(now - 1000)).toBe("just now");
    expect(relTime(now - 1000 * 60 * 5)).toBe("5m ago");
    expect(relTime(now - 1000 * 60 * 60 * 2)).toBe("2h ago");
    expect(relTime(now - 1000 * 60 * 60 * 24)).toBe("yesterday");
    expect(relTime(now - 1000 * 60 * 60 * 24 * 3)).toBe("3 days ago");
    expect(relTime(now - 1000 * 60 * 60 * 24 * 7)).toBe("1 week ago");
    expect(relTime(now - 1000 * 60 * 60 * 24 * 14)).toBe("2 weeks ago");
  });

  it("adds, updates, pins, and deletes notes deterministically", () => {
    const initial: NotesPersistedState = { notes: [], categories: DEFAULT_CATEGORIES };
    const note: Note = {
      id: "note-1",
      title: "Architecture Decisions",
      body: "Decentralized storage with local-first sync",
      tag: "Idea",
      pinned: false,
      updatedAt: 1000,
      contentType: "idea",
    };

    const added = addNoteOperation(initial, note);
    expect(added.notes.length).toBe(1);
    expect(added.notes[0].id).toBe("note-1");

    const pinned = togglePinOperation(added, "note-1");
    expect(pinned.notes[0].pinned).toBe(true);

    const updated = updateNoteOperation(pinned, "note-1", { title: "ADR-001: Local-First" }, 2000);
    expect(updated.notes[0].title).toBe("ADR-001: Local-First");
    expect(updated.notes[0].updatedAt).toBe(2000);

    const deleted = deleteNoteOperation(updated, "note-1");
    expect(deleted.notes.length).toBe(0);
  });

  it("handles category management and fallback on category deletion", () => {
    const initial: NotesPersistedState = { notes: [], categories: DEFAULT_CATEGORIES };
    const newCat: NoteCategory = { id: "cat-books", name: "Books", color: "#purple" };
    const withCat = addCategoryOperation(initial, newCat);
    expect(withCat.categories.find((c) => c.id === "cat-books")).toBeDefined();

    const noteWithCat: Note = {
      id: "note-book",
      title: "Clean Architecture",
      body: "Book summary notes",
      tag: "Books",
      pinned: false,
      updatedAt: 1000,
    };
    const withNote = addNoteOperation(withCat, noteWithCat);
    expect(withNote.notes[0].tag).toBe("Books");

    // Deleting "Books" category should re-tag associated notes to fallback category ("Personal")
    const afterDeleteCat = deleteCategoryOperation(withNote, "cat-books", 2000);
    expect(afterDeleteCat.categories.find((c) => c.id === "cat-books")).toBeUndefined();
    expect(afterDeleteCat.notes[0].tag).toBe("Personal");
    expect(afterDeleteCat.notes[0].updatedAt).toBe(2000);
  });

  it("updates note section and category sections cleanly", () => {
    const initial: NotesPersistedState = {
      notes: [{ id: "note-1", title: "Idea 1", body: "text", tag: "Ideas", pinned: false, updatedAt: 1000 }],
      categories: [{ id: "cat-ideas", name: "Ideas", color: "#37c9b7" }],
    };

    const withSections = updateCategoryOperation(initial, "cat-ideas", { sections: ["Approved", "Rejected"] });
    expect(withSections.categories[0].sections).toEqual(["Approved", "Rejected"]);

    const withNoteSection = updateNoteOperation(withSections, "note-1", { section: "Approved" }, 2000);
    expect(withNoteSection.notes[0].section).toBe("Approved");
    expect(withNoteSection.notes[0].updatedAt).toBe(2000);

    const clearedSection = updateNoteOperation(withNoteSection, "note-1", { section: undefined }, 3000);
    expect(clearedSection.notes[0].section).toBeUndefined();
  });

  it("handles large note content smoothly without truncation", () => {
    const initial: NotesPersistedState = { notes: [], categories: DEFAULT_CATEGORIES };
    const largeBody = "# Extensive Document\n\n" + "Lorem ipsum dolor sit amet. ".repeat(10000);
    const largeNote: Note = {
      id: "large-note-1",
      title: "Extensive Guide",
      body: largeBody,
      tag: "Reference",
      pinned: false,
      updatedAt: Date.now(),
    };

    const added = addNoteOperation(initial, largeNote);
    expect(added.notes[0].body.length).toBeGreaterThan(200000);
    expect(added.notes[0].body).toBe(largeBody);
  });
});

describe("Notes Domain — Migrations", () => {
  it("migrates older version snapshots (< v3) with contentType and categories fallback", () => {
    const oldSnapshot = {
      notes: [
        {
          id: "n-old",
          title: "Legacy Note",
          body: "Legacy content",
          tag: "Personal",
          pinned: false,
          updatedAt: 100,
        },
      ],
      categories: [],
    };

    const migrated = migrateNotesSnapshot(oldSnapshot, 1);
    expect(migrated.notes.length).toBe(1);
    expect(migrated.notes[0].contentType).toBe("note");
    expect(migrated.categories).toEqual(DEFAULT_CATEGORIES);
  });

  it("throws error for unsupported future version", () => {
    expect(() => migrateNotesSnapshot({ notes: [] }, CURRENT_NOTES_VERSION + 1)).toThrow();
  });
});

describe("Notes Domain — Coalescing Save Queue", () => {
  it("bounds total writes during rapid bursts and preserves the final edit", async () => {
    const savedPayloads: string[] = [];
    let saveCount = 0;

    const queue = new CoalescingSaveQueue<string>({
      saveFn: async (payload) => {
        saveCount++;
        // Simulate async I/O latency
        await new Promise((resolve) => setTimeout(resolve, 20));
        savedPayloads.push(payload);
      },
    });

    // Enqueue 20 rapid edits
    for (let i = 1; i <= 20; i++) {
      queue.enqueue(`Draft content version ${i}`);
    }

    // Wait for queue to flush
    await queue.flush();

    // Writes must be bounded: at most 2 writes (1 in-flight + 1 coalesced final draft)
    expect(saveCount).toBeLessThanOrEqual(2);
    expect(queue.getWriteCount()).toBeLessThanOrEqual(2);
    // Final stored payload MUST be the last edit (version 20)
    expect(savedPayloads[savedPayloads.length - 1]).toBe("Draft content version 20");
    expect(queue.getStatus()).toBe("saved");
  });

  it("preserves draft on failure and succeeds on retry", async () => {
    let failFirstTime = true;
    const statuses: string[] = [];
    const saved: string[] = [];

    const queue = new CoalescingSaveQueue<string>({
      onStatusChange: (status) => statuses.push(status),
      saveFn: async (payload) => {
        if (failFirstTime) {
          failFirstTime = false;
          throw new Error("Network timeout");
        }
        saved.push(payload);
      },
    });

    await expect(queue.enqueue("Critical draft content")).rejects.toThrow("Network timeout");
    expect(queue.getStatus()).toBe("failed");
    expect(queue.getLatestDraft()).toBe("Critical draft content");

    // Retry must use preserved latest draft and succeed
    await queue.retry();
    expect(queue.getStatus()).toBe("saved");
    expect(saved).toEqual(["Critical draft content"]);
  });
});

describe("Notes Domain — Adapter Integration, Serialization & Trash Bridge", () => {
  let localAdapter: LocalAdapter;
  let queryClient: ReturnType<typeof createMemoryQueryClient>;

  beforeEach(async () => {
    testLocalStorage.clear();
    localAdapter = new LocalAdapter({ databaseName: `test-notes-db-${Date.now()}` });
    await localAdapter.initialize();
    await localAdapter.putStore({
      store: "lifeos-notes",
      version: 3,
      state: { notes: [], categories: DEFAULT_CATEGORIES },
      updatedAt: new Date().toISOString(),
      revision: 1,
    });
    queryClient = createMemoryQueryClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      DataProvider,
      { adapter: localAdapter, queryClient, edition: "local" },
      children,
    );
  }

  it("reads, adds, updates notes and bridges delete to Trash", async () => {
    const { result } = renderHook(() => useNotesData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let createdNote!: Note;
    await act(async () => {
      createdNote = await result.current.addNote({
        title: "Initial Draft",
        body: "First version of ideas",
        tag: "Idea",
      });
    });

    expect(createdNote.id).toBeDefined();
    await waitFor(() => expect(result.current.notes.length).toBe(1));
    expect(result.current.notes[0].title).toBe("Initial Draft");

    // Update note
    await act(async () => {
      await result.current.updateNote(createdNote.id, { title: "Refined Draft", body: "Polished text" });
    });
    await waitFor(() => expect(result.current.notes[0].title).toBe("Refined Draft"));

    // Delete note -> bridges to Trash store
    await act(async () => {
      await result.current.deleteNote(createdNote.id);
    });
    await waitFor(() => expect(result.current.notes.length).toBe(0));

    // Verify Trash received the deleted note
    const trashDoc = await localAdapter.getStore("lifeos-trash");
    const trashItems = (trashDoc?.state?.items as Array<{ originalStoreKey: string; title: string }>) || [];
    const trashed = trashItems.find((i) => i.originalStoreKey === "lifeos-notes");
    expect(trashed).toBeDefined();
    expect(trashed?.title).toBe("Refined Draft");
  });

  it("proves Trash failure aborts deletion and preserves the note", async () => {
    const { result } = renderHook(() => useNotesData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let createdNote!: Note;
    await act(async () => {
      createdNote = await result.current.addNote({
        title: "Preserved Note Under Trash Error",
        body: "Must not be deleted if trash fails",
        tag: "Personal",
      });
    });

    await waitFor(() => expect(result.current.notes.length).toBe(1));

    // Spy on localAdapter.mutateStore for lifeos-trash to throw an unrecoverable failure
    const originalMutate = localAdapter.mutateStore.bind(localAdapter);
    vi.spyOn(localAdapter, "mutateStore").mockImplementation(async (key: any, updater: any) => {
      if (key === "lifeos-trash") {
        throw new Error("Trash disk quota exceeded or storage error");
      }
      return (originalMutate as any)(key, updater);
    });

    // Attempting deleteNote MUST throw and abort
    await expect(
      act(async () => {
        await result.current.deleteNote(createdNote.id);
      }),
    ).rejects.toThrow("Trash disk quota exceeded or storage error");

    // The note must STILL exist in state and in localAdapter!
    expect(result.current.notes.length).toBe(1);
    expect(result.current.notes[0].id).toBe(createdNote.id);

    const doc = await localAdapter.getStore("lifeos-notes");
    expect(doc?.state.notes.some((n) => n.id === createdNote.id)).toBe(true);
  });

  it("serializes concurrent saves so older mutations cannot overwrite newer content", async () => {
    const { result } = renderHook(() => useNotesData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let createdNote!: Note;
    await act(async () => {
      createdNote = await result.current.addNote({
        title: "Concurrency Test",
        body: "Draft v0",
        tag: "Draft",
      });
    });

    // Fire 5 rapid concurrent updates in sequence
    await act(async () => {
      const p1 = result.current.updateNote(createdNote.id, { body: "Draft v1" });
      const p2 = result.current.updateNote(createdNote.id, { body: "Draft v2" });
      const p3 = result.current.updateNote(createdNote.id, { body: "Draft v3" });
      const p4 = result.current.updateNote(createdNote.id, { body: "Draft v4" });
      const p5 = result.current.updateNote(createdNote.id, { body: "Draft v5 final" });
      await Promise.all([p1, p2, p3, p4, p5]);
    });

    await waitFor(() => expect(result.current.notes[0].body).toBe("Draft v5 final"));

    // Stored Dexie snapshot must match final serialized version
    const stored = await localAdapter.getStore("lifeos-notes");
    expect(stored?.state.notes[0].body).toBe("Draft v5 final");
  });
});
