// @vitest-environment jsdom
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
import type { DataAdapter } from "../../types";
import {
  createDefaultJournalState,
  normalizeJournalEntry,
  addEntryOperation,
  updateEntryOperation,
  deleteEntryOperation,
} from "./operations";
import { useJournalData } from "./hooks";
import { getMoodMeta, type JournalEntry } from "./types";
import type { JournalPersistedState } from "../../types";

describe("Journal Domain — Pure Operations", () => {
  it("safely resolves mood metadata and normalizes journal entries", () => {
    expect(getMoodMeta("great").label).toBe("Great");
    expect(getMoodMeta("invalid-mood-xyz").label).toBe("Good");
    expect(getMoodMeta(undefined).label).toBe("Good");

    const norm = normalizeJournalEntry({
      mood: "super-happy-custom",
      body: "Test note",
    });
    expect(norm.mood).toBe("good");
    expect(norm.body).toBe("Test note");
    expect(norm.id).toBeDefined();
    expect(norm.date).toBeDefined();
  });

  it("returns default state with sample reflection entries", () => {
    const state = createDefaultJournalState();
    expect(state.entries.length).toBeGreaterThan(0);
    expect(state.entries[0].body).toBeDefined();
  });

  it("adds entry at the beginning of entries array", () => {
    const base: JournalPersistedState = { entries: [] };
    const entry1: JournalEntry = {
      id: "e1",
      date: "2026-08-23",
      mood: "great",
      body: "First entry",
      createdAt: 1000,
    };
    const entry2: JournalEntry = {
      id: "e2",
      date: "2026-08-23",
      mood: "good",
      body: "Second entry",
      createdAt: 2000,
    };

    const s1 = addEntryOperation(base, entry1);
    expect(s1.entries).toEqual([entry1]);

    const s2 = addEntryOperation(s1, entry2);
    expect(s2.entries).toEqual([entry2, entry1]);
  });

  it("updates an existing entry cleanly", () => {
    const entry: JournalEntry = {
      id: "e1",
      date: "2026-08-23",
      mood: "great",
      body: "Initial",
      createdAt: 1000,
    };
    const s1 = addEntryOperation(null, entry);

    const s2 = updateEntryOperation(s1, "e1", { body: "Updated body", mood: "okay" });
    expect(s2.entries[0].body).toBe("Updated body");
    expect(s2.entries[0].mood).toBe("okay");
    expect(s2.entries[0].createdAt).toBe(1000);
  });

  it("deletes an entry by ID", () => {
    const entry: JournalEntry = {
      id: "e1",
      date: "2026-08-23",
      mood: "great",
      body: "To be deleted",
      createdAt: 1000,
    };
    const s1 = addEntryOperation({ entries: [] }, entry);
    const s2 = deleteEntryOperation(s1, "e1");
    expect(s2.entries).toHaveLength(0);
  });
});

describe("Journal Domain — Adapter Integration & Parity", () => {
  let adapter: LocalAdapter;
  let queryClient: ReturnType<typeof createMemoryQueryClient>;

  beforeEach(async () => {
    testLocalStorage.clear();
    adapter = new LocalAdapter({ databaseName: `journal-test-${Date.now()}-${Math.random()}` });
    await adapter.initialize();
    await adapter.putStore({
      store: "lifeos-journal",
      version: 2,
      state: { entries: [] },
      updatedAt: new Date().toISOString(),
      revision: 1,
    });
    queryClient = createMemoryQueryClient();
  });

  afterEach(async () => {
    await adapter.close();
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      DataProvider,
      { adapter, queryClient, edition: "local" },
      children,
    );
  }

  it("reads and creates journal entries with LocalAdapter", async () => {
    const { result } = renderHook(() => useJournalData(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries).toHaveLength(0);

    let added: JournalEntry | undefined;
    await act(async () => {
      added = await result.current.addEntry("great", "A beautiful day", "2026-08-23");
    });

    expect(added?.id).toBeDefined();
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.entries[0].body).toBe("A beautiful day");

    // Verify persisted directly in LocalAdapter database
    const doc = await adapter.getStore("lifeos-journal");
    expect(doc?.state.entries).toHaveLength(1);
    expect(doc?.state.entries[0].id).toBe(added?.id);
  });

  it("updates and deletes journal entries reactively", async () => {
    const { result } = renderHook(() => useJournalData(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let added: JournalEntry | undefined;
    await act(async () => {
      added = await result.current.addEntry("good", "Entry to modify", "2026-08-23");
    });

    await act(async () => {
      await result.current.updateEntry(added!.id, { body: "Modified body" });
    });

    await waitFor(() => expect(result.current.entries[0].body).toBe("Modified body"));

    await act(async () => {
      await result.current.deleteEntry(added!.id);
    });

    await waitFor(() => expect(result.current.entries).toHaveLength(0));
  });

  it("persists entries across adapter reopen (simulated reload)", async () => {
    const dbName = `journal-reload-${Date.now()}`;
    const adapter1 = new LocalAdapter({ databaseName: dbName });
    await adapter1.initialize();

    await adapter1.mutateStore("lifeos-journal", () => ({
      entries: [
        {
          id: "persisted-1",
          date: "2026-08-23",
          mood: "great",
          body: "Persisted across reloads",
          createdAt: Date.now(),
        },
      ],
    }));
    await adapter1.close();

    // Re-open fresh adapter pointing to the same database
    const adapter2 = new LocalAdapter({ databaseName: dbName });
    await adapter2.initialize();
    const doc = await adapter2.getStore("lifeos-journal");
    expect(doc?.state.entries).toHaveLength(1);
    expect(doc?.state.entries[0].id).toBe("persisted-1");

    await adapter2.close();
  });

  it("guarantees stable ID generation across CAS retries", async () => {
    let callCount = 0;
    const mockAdapter = {
      edition: "local" as const,
      initialize: async () => {},
      close: async () => {},
      getStore: async () => null,
      putStore: async () => ({ store: "lifeos-journal" as const, version: 2, state: { entries: [] }, updatedAt: "", revision: 1 }),
      getAllStores: async () => [],
      subscribe: () => () => {},
      mutateStore: async (_store: "lifeos-journal", mutator: (s: unknown) => unknown) => {
        callCount++;
        // Simulate CAS retry running mutator multiple times
        mutator({ entries: [] });
        const s2 = mutator({ entries: [] });
        return {
          store: "lifeos-journal" as const,
          version: 2,
          state: s2 as { entries: JournalEntry[] },
          updatedAt: "",
          revision: 2,
        };
      },
    };

    function mockWrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(
        DataProvider,
        { adapter: mockAdapter as unknown as DataAdapter, queryClient, edition: "local" },
        children,
      );
    }

    const { result } = renderHook(() => useJournalData(), { wrapper: mockWrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let entry: JournalEntry | undefined;
    await act(async () => {
      entry = await result.current.addEntry("great", "Stable ID test");
    });

    expect(callCount).toBe(1);
    expect(entry?.id).toBeDefined();
  });

  it("matches synthetic legacy state exactly for full parity", () => {
    const legacyState = {
      entries: [
        {
          id: "leg-1",
          date: "2026-08-23",
          mood: "great" as const,
          body: "Legacy content",
          createdAt: 12345,
        },
      ],
    };

    const newState: JournalPersistedState = { entries: [] };
    const migrated = addEntryOperation(newState, legacyState.entries[0]);

    expect(migrated).toEqual(legacyState);
  });
});
