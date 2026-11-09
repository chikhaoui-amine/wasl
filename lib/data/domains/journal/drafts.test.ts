// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

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

import {
  getJournalDraftKey,
  loadJournalDraft,
  saveJournalDraft,
  clearJournalDraft,
  hasJournalDraft,
} from "./drafts";

describe("journal drafts persistence", () => {
  beforeEach(() => {
    testLocalStorage.clear();
  });

  it("generates date-keyed storage keys", () => {
    expect(getJournalDraftKey("2026-11-09")).toBe("wasl_journal_draft_2026-11-09");
  });

  it("saves and loads draft for a given date", () => {
    expect(loadJournalDraft("2026-11-09")).toBeNull();
    expect(hasJournalDraft("2026-11-09")).toBe(false);

    saveJournalDraft("2026-11-09", { body: "Reflecting on today", mood: "great" });

    expect(hasJournalDraft("2026-11-09")).toBe(true);
    const loaded = loadJournalDraft("2026-11-09");
    expect(loaded).not.toBeNull();
    expect(loaded?.body).toBe("Reflecting on today");
    expect(loaded?.mood).toBe("great");
    expect(typeof loaded?.updatedAt).toBe("number");
  });

  it("clears draft when empty or explicitly cleared", () => {
    saveJournalDraft("2026-11-09", { body: "Temporary thought", mood: "good" });
    expect(hasJournalDraft("2026-11-09")).toBe(true);

    clearJournalDraft("2026-11-09");
    expect(hasJournalDraft("2026-11-09")).toBe(false);
    expect(loadJournalDraft("2026-11-09")).toBeNull();
  });

  it("automatically removes draft when saving whitespace or empty body", () => {
    saveJournalDraft("2026-11-09", { body: "Something", mood: "good" });
    expect(hasJournalDraft("2026-11-09")).toBe(true);

    saveJournalDraft("2026-11-09", { body: "   \n  ", mood: "good" });
    expect(hasJournalDraft("2026-11-09")).toBe(false);
  });
});
