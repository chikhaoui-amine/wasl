import type { Mood } from "./types";

export interface JournalDraft {
  body: string;
  mood: Mood;
  updatedAt: number;
}

const DRAFT_PREFIX = "wasl_journal_draft_";

export function getJournalDraftKey(date: string): string {
  return `${DRAFT_PREFIX}${date}`;
}

export function loadJournalDraft(date: string): JournalDraft | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(getJournalDraftKey(date));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.body === "string" && parsed.body.trim().length > 0) {
      return {
        body: parsed.body,
        mood: (parsed.mood as Mood) || "good",
        updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
      };
    }
  } catch {
    // Ignore storage parse errors
  }
  return null;
}

export function saveJournalDraft(date: string, draft: { body: string; mood: Mood }): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  const key = getJournalDraftKey(date);
  if (!draft.body.trim()) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
    return;
  }
  try {
    const payload: JournalDraft = {
      body: draft.body,
      mood: draft.mood,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearJournalDraft(date: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(getJournalDraftKey(date));
  } catch {
    // Ignore storage errors
  }
}

export function hasJournalDraft(date: string): boolean {
  return loadJournalDraft(date) !== null;
}

const EDIT_DRAFT_PREFIX = "wasl_journal_edit_";

export function getJournalEditDraftKey(entryId: string): string {
  return `${EDIT_DRAFT_PREFIX}${entryId}`;
}

export function loadJournalEditDraft(entryId: string): JournalDraft | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(getJournalEditDraftKey(entryId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.body === "string" && parsed.body.trim().length > 0) {
      return {
        body: parsed.body,
        mood: (parsed.mood as Mood) || "good",
        updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
      };
    }
  } catch {
    // Ignore storage parse errors
  }
  return null;
}

export function saveJournalEditDraft(entryId: string, draft: { body: string; mood: Mood }): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  const key = getJournalEditDraftKey(entryId);
  if (!draft.body.trim()) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
    return;
  }
  try {
    const payload: JournalDraft = {
      body: draft.body,
      mood: draft.mood,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearJournalEditDraft(entryId: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(getJournalEditDraftKey(entryId));
  } catch {
    // Ignore storage errors
  }
}

