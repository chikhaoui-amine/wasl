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
import { useBlocksData } from "./hooks";
import {
  createDefaultBlocksState,
  addBlockOperation,
  updateBlockOperation,
  deleteBlockOperation,
  setViewOperation,
  setAnchorOperation,
  type Block,
} from "./operations";
import type { BlocksPersistedState } from "../../types";
import { migrateBlocksSnapshot, CURRENT_BLOCKS_VERSION } from "./migrations";

describe("Blocks Domain — Pure Operations", () => {
  it("creates default state with sample blocks, week view and anchor", () => {
    const state = createDefaultBlocksState();
    expect(state.blocks.length).toBeGreaterThan(0);
    expect(state.view).toBe("week");
    expect(state.anchor).toBeDefined();
  });

  it("adds, updates, changes view/anchor, and deletes blocks", () => {
    const initial: BlocksPersistedState = { blocks: [], view: "week", anchor: "2026-08-23" };
    const block: Block = {
      id: "block-1",
      date: "2026-08-23",
      start: 9,
      end: 11.5,
      title: "Deep Work Focus",
      color: "var(--accent)",
    };

    const added = addBlockOperation(initial, block);
    expect(added.blocks.length).toBe(1);

    const updated = updateBlockOperation(added, "block-1", { start: 10, end: 12 });
    expect(updated.blocks[0].start).toBe(10);
    expect(updated.blocks[0].end).toBe(12);

    const viewUpdated = setViewOperation(updated, "day");
    expect(viewUpdated.view).toBe("day");

    const anchorUpdated = setAnchorOperation(viewUpdated, "2026-08-23");
    expect(anchorUpdated.anchor).toBe("2026-08-23");

    const deleted = deleteBlockOperation(anchorUpdated, "block-1");
    expect(deleted.blocks.length).toBe(0);
  });
});

describe("Blocks Domain — Migrations", () => {
  it("migrates older version snapshots (< v3) cleanly", () => {
    const oldSnapshot = {
      blocks: [{ id: "b-1", date: "2026-08-23", start: 8, end: 9, title: "Old Block" }],
    };
    const migrated = migrateBlocksSnapshot(oldSnapshot, 1);
    expect(migrated.blocks.length).toBe(1);
    expect(migrated.view).toBe("week");
    expect(migrated.anchor).toBeDefined();
  });

  it("throws error for unsupported future version", () => {
    expect(() => migrateBlocksSnapshot({ blocks: [] }, CURRENT_BLOCKS_VERSION + 1)).toThrow();
  });
});

describe("Blocks Domain — Adapter Integration", () => {
  let localAdapter: LocalAdapter;
  let queryClient: ReturnType<typeof createMemoryQueryClient>;

  beforeEach(async () => {
    testLocalStorage.clear();
    localAdapter = new LocalAdapter({ databaseName: `test-blocks-db-${Date.now()}` });
    await localAdapter.initialize();
    await localAdapter.putStore({
      store: "lifeos-blocks",
      version: 3,
      state: { blocks: [], view: "week", anchor: "2026-08-23" },
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

  it("reads, adds, updates blocks and toggles view mode", async () => {
    const { result } = renderHook(() => useBlocksData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let createdBlock!: Block;
    await act(async () => {
      createdBlock = await result.current.addBlock({
        date: "2026-08-23",
        start: 14,
        end: 16,
        title: "Sprint Planning",
        color: "var(--accent)",
      });
    });

    expect(createdBlock.id).toBeDefined();
    await waitFor(() => expect(result.current.blocks.length).toBe(1));

    // Update
    await act(async () => {
      await result.current.updateBlock(createdBlock.id, { title: "Sprint Planning & Review" });
    });
    await waitFor(() => expect(result.current.blocks[0].title).toBe("Sprint Planning & Review"));

    // Set view
    await act(async () => {
      await result.current.setView("day");
    });
    await waitFor(() => expect(result.current.view).toBe("day"));

    // Delete
    await act(async () => {
      await result.current.deleteBlock(createdBlock.id);
    });
    await waitFor(() => expect(result.current.blocks.length).toBe(0));
  });
});
