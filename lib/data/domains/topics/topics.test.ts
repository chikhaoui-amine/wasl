// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { LocalAdapter } from "../../adapters/local/local-adapter";
import { DataProvider, createMemoryQueryClient } from "../../query/provider";
import type { DataAdapter, TopicsPersistedState } from "../../types";
import { useTopicsData } from "./hooks";
import {
  createDefaultTopicsState,
  normalizeTopic,
  addTopicOperation,
  updateTopicOperation,
  deleteTopicOperation,
  addStepOperation,
  toggleStepOperation,
  addSubstepOperation,
  toggleSubstepOperation,
  addResourceOperation,
  toggleResourceOperation,
  addNoteOperation,
  updateNoteOperation,
  topicProgress,
  type Topic,
  type TopicStep,
  type TopicSubstep,
  type TopicResource,
  type TopicNote,
} from "./operations";
import { migrateTopicsSnapshot, CURRENT_TOPICS_VERSION } from "./migrations";

describe("Topics Domain — Pure Operations", () => {
  it("normalizes topics and cleans dirty icons and fields", () => {
    const norm = normalizeTopic({
      name: "   AI Agents   ",
      icon: "Brain",
      roadmap: [{ title: "Setup" }],
    });
    expect(norm.name).toBe("AI Agents");
    expect(norm.icon).toBe("brain");
    expect(norm.roadmap[0].id).toBeDefined();
    expect(norm.roadmap[0].substeps).toEqual([]);
    expect(norm.resources).toEqual([]);
    expect(norm.notes).toEqual([]);
  });

  it("creates default state with sample learning topics and roadmaps", () => {
    const defaultState = createDefaultTopicsState();
    expect(defaultState.topics.length).toBeGreaterThan(0);
    expect(defaultState.topics[0].name).toBeDefined();
  });

  it("calculates topicProgress accurately across steps and substeps", () => {
    const sampleTopic: Topic = {
      id: "t1",
      name: "TypeScript Deep Dive",
      icon: "code",
      color: "#37c9b7",
      description: "Mastering TS",
      createdAt: 1000,
      touchedAt: 1000,
      roadmap: [
        {
          id: "s1",
          title: "Generics",
          done: false,
          substeps: [
            { id: "sub1", title: "Constraints", done: true },
            { id: "sub2", title: "Conditional Types", done: false },
          ],
        },
        {
          id: "s2",
          title: "Utility Types",
          done: true,
          substeps: [],
        },
      ],
      resources: [],
      notes: [],
    };

    // Total units: 2 (substeps of s1) + 1 (s2 with no substeps) = 3 units
    // Done units: 1 (sub1) + 1 (s2) = 2 units => 2/3 = 67%
    expect(topicProgress(sampleTopic)).toBe(67);
    expect(topicProgress(null)).toBe(0);
    expect(topicProgress({ roadmap: [] })).toBe(0);
  });

  it("adds, updates, and deletes topics deterministically", () => {
    const initial: TopicsPersistedState = { topics: [] };
    const topic: Topic = {
      id: "t-ai",
      name: "Machine Learning",
      icon: "cpu",
      color: "#7c9cf5",
      description: "AI notes",
      roadmap: [],
      resources: [],
      notes: [],
      createdAt: 100,
      touchedAt: 100,
    };

    const added = addTopicOperation(initial, topic);
    expect(added.topics.length).toBe(1);
    expect(added.topics[0].id).toBe("t-ai");

    const updated = updateTopicOperation(added, "t-ai", { name: "Applied Machine Learning" }, 200);
    expect(updated.topics[0].name).toBe("Applied Machine Learning");
    expect(updated.topics[0].touchedAt).toBe(200);

    const deleted = deleteTopicOperation(updated, "t-ai");
    expect(deleted.topics.length).toBe(0);
  });

  it("handles roadmap steps and substeps hierarchically", () => {
    const topic: Topic = {
      id: "t-rust",
      name: "Rust",
      icon: "terminal",
      color: "#e0a34a",
      description: "Systems programming",
      roadmap: [],
      resources: [],
      notes: [],
      createdAt: 100,
      touchedAt: 100,
    };
    let state = addTopicOperation(createDefaultTopicsState(), topic);

    // Add step
    const step1: TopicStep = {
      id: "step-ownership",
      title: "Ownership & Borrowing",
      done: false,
      collapsed: false,
      substeps: [],
    };
    state = addStepOperation(state, "t-rust", step1);
    expect(state.topics[0].roadmap.length).toBe(1);

    // Add substeps
    const sub1: TopicSubstep = { id: "sub-borrow", title: "Borrow checker", done: false };
    const sub2: TopicSubstep = { id: "sub-lifetime", title: "Lifetimes", done: false };
    state = addSubstepOperation(state, "t-rust", "step-ownership", sub1);
    state = addSubstepOperation(state, "t-rust", "step-ownership", sub2);
    expect(state.topics[0].roadmap[0].substeps?.length).toBe(2);

    // Toggle substep 1 -> step not done yet
    state = toggleSubstepOperation(state, "t-rust", "step-ownership", "sub-borrow");
    expect(state.topics[0].roadmap[0].substeps?.[0].done).toBe(true);
    expect(state.topics[0].roadmap[0].done).toBe(false);

    // Toggle substep 2 -> all substeps done => step automatically becomes done
    state = toggleSubstepOperation(state, "t-rust", "step-ownership", "sub-lifetime");
    expect(state.topics[0].roadmap[0].done).toBe(true);

    // Toggle step false -> both substeps become false
    state = toggleStepOperation(state, "t-rust", "step-ownership");
    expect(state.topics[0].roadmap[0].done).toBe(false);
    expect(state.topics[0].roadmap[0].substeps?.every((s) => !s.done)).toBe(true);
  });

  it("handles topic resources and notes", () => {
    const topic: Topic = {
      id: "t-web",
      name: "Web Dev",
      icon: "globe",
      color: "#37c9b7",
      description: "Frontend & Backend",
      roadmap: [],
      resources: [],
      notes: [],
      createdAt: 100,
      touchedAt: 100,
    };
    let state = addTopicOperation(createDefaultTopicsState(), topic);

    // Add resource
    const res: TopicResource = {
      id: "res-docs",
      title: "MDN Web Docs",
      url: "https://developer.mozilla.org",
      done: false,
    };
    state = addResourceOperation(state, "t-web", res);
    expect(state.topics[0].resources.length).toBe(1);

    // Toggle resource
    state = toggleResourceOperation(state, "t-web", "res-docs");
    expect(state.topics[0].resources[0].done).toBe(true);

    // Add & update note
    const note: TopicNote = {
      id: "note-1",
      title: "CSS Grid vs Flexbox",
      text: "Grid is 2D, Flexbox is 1D",
      createdAt: 100,
      updatedAt: 100,
    };
    state = addNoteOperation(state, "t-web", note);
    expect(state.topics[0].notes.length).toBe(1);

    state = updateNoteOperation(state, "t-web", "note-1", "CSS Grid vs Flexbox", "Updated note text", 200);
    expect(state.topics[0].notes[0].text).toBe("Updated note text");
    expect(state.topics[0].notes[0].title).toBe("CSS Grid vs Flexbox");
    expect(state.topics[0].notes[0].updatedAt).toBe(200);
  });
});

describe("Topics Domain — Migrations", () => {
  it("migrates legacy v1 emoji to v4 iconKey correctly", () => {
    const legacyV1 = {
      topics: [
        {
          id: "t-old",
          name: "Old Topic",
          emoji: "🚀",
          color: "#37c9b7",
          roadmap: [{ id: "s1", title: "Step 1", done: true }],
        },
      ],
    };

    const migrated = migrateTopicsSnapshot(legacyV1, 1);
    expect(migrated.topics.length).toBe(1);
    expect(migrated.topics[0].icon).toBe("rocket");
    expect(migrated.topics[0].roadmap[0].substeps).toEqual([]);
  });

  it("migrates v3 topics state to v4 preserving all fields", () => {
    const v3State = {
      topics: [
        {
          id: "t3",
          name: "V3 Topic",
          icon: "brain",
          color: "#ec4899",
          description: "Neuroscience",
          createdAt: 123456,
          touchedAt: 234567,
          roadmap: [
            {
              id: "s-brain",
              title: "Synapses",
              done: false,
              collapsed: true,
              substeps: [{ id: "sub-neuro", title: "Dopamine", done: true }],
            },
          ],
          resources: [{ id: "r1", title: "Paper", url: "https://example.com", done: false }],
          notes: [{ id: "n1", title: "Quick Note", text: "Important note", createdAt: 100, updatedAt: 100 }],
        },
      ],
    };

    const migrated = migrateTopicsSnapshot(v3State, 3);
    expect(migrated.topics.length).toBe(1);
    expect(migrated.topics[0].name).toBe("V3 Topic");
    expect(migrated.topics[0].icon).toBe("brain");
    expect(migrated.topics[0].roadmap[0].substeps?.length).toBe(1);
    expect(migrated.topics[0].roadmap[0].substeps?.[0].title).toBe("Dopamine");
  });

  it("throws error for unsupported future version", () => {
    expect(() => migrateTopicsSnapshot({}, CURRENT_TOPICS_VERSION + 1)).toThrow(
      /Unsupported future Topics version/,
    );
  });
});

describe("Topics Domain — TanStack Query Hooks & DataAdapter Integration", () => {
  let localAdapter: LocalAdapter;
  let queryClient: ReturnType<typeof createMemoryQueryClient>;

  beforeEach(async () => {
    localAdapter = new LocalAdapter({ databaseName: `test-topics-db-${Date.now()}` });
    await localAdapter.initialize();
    await localAdapter.putStore({
      store: "lifeos-topics",
      version: 4,
      state: { topics: [] },
      updatedAt: new Date().toISOString(),
      revision: 1,
    });
    queryClient = createMemoryQueryClient();
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      DataProvider,
      { adapter: localAdapter, queryClient, edition: "local" },
      children,
    );
  }

  it("reads, creates topic, adds roadmap step and persists across local adapter", async () => {
    const { result } = renderHook(() => useTopicsData(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.topics).toEqual([]);

    let createdTopic!: Topic;
    await act(async () => {
      createdTopic = await result.current.addTopic({
        name: "Next.js 15 App Router",
        icon: "zap",
        color: "#37c9b7",
        description: "Server Actions and PPR",
      });
    });

    expect(createdTopic.id).toBeDefined();
    await waitFor(() => expect(result.current.topics.length).toBe(1));
    expect(result.current.topics[0].name).toBe("Next.js 15 App Router");

    // Add step
    await act(async () => {
      await result.current.addStep(createdTopic.id, "Server Components");
    });
    await waitFor(() => expect(result.current.topics[0].roadmap.length).toBe(1));

    // Verify stored snapshot in Dexie
    const stored = await localAdapter.getStore("lifeos-topics");
    expect(stored?.version).toBe(4);
    expect(stored?.state.topics.length).toBe(1);
    expect(stored?.state.topics[0].roadmap[0].title).toBe("Server Components");
  });

  it("maintains stable topic and step IDs across CAS retries", async () => {
    let retryAttempt = 0;
    const casTrackingAdapter = {
      initialize: () => Promise.resolve(),
      close: () => Promise.resolve(),
      getStore: () =>
        Promise.resolve({
          store: "lifeos-topics",
          version: 4,
          state: { topics: [] },
          updatedAt: "2026-08-23",
        }),
      putStore: () =>
        Promise.resolve({
          store: "lifeos-topics",
          version: 4,
          state: { topics: [] },
          updatedAt: "2026-08-23",
        }),
      mutateStore: async (_key: string, updater: (state: TopicsPersistedState) => TopicsPersistedState) => {
        retryAttempt++;
        // Simulate CAS retry on first try
        if (retryAttempt === 1) {
          updater({ topics: [] }); // simulate first attempt
        }
        const state = updater({ topics: [] });
        return {
          store: "lifeos-topics",
          version: 4,
          state,
          updatedAt: new Date().toISOString(),
        };
      },
      getAllStores: () => Promise.resolve([]),
      subscribe: () => () => {},
    };

    function casWrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(
        DataProvider,
        { adapter: casTrackingAdapter as unknown as DataAdapter, queryClient, edition: "local" },
        children,
      );
    }

    const { result } = renderHook(() => useTopicsData(), { wrapper: casWrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let createdTopic!: Topic;
    await act(async () => {
      createdTopic = await result.current.addTopic({
        name: "Deterministic CAS Topic",
        icon: "target",
        color: "#7c9cf5",
        description: "Verify stable IDs",
      });
    });

    expect(createdTopic.id).toBeDefined();
    expect(retryAttempt).toBe(1);
  });
});
