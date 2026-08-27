import { addDays, todayISO } from "@/lib/date";
import type { JournalPersistedState } from "../../types";
import { MOOD_META, type JournalEntry, type Mood } from "./types";

export function createDefaultJournalState(): JournalPersistedState {
  const t = todayISO();
  const d1 = addDays(t, -1);
  const now = Date.now();
  return {
    entries: [
      {
        id: "journal-sample-1",
        date: t,
        mood: "great",
        body: `### Morning Intention
Clear focus and strong energy. Starting the day with deep focus on system architecture.

### Daily Gratitude
1. Clarity of direction and purpose.
2. Good morning coffee and a brisk walk.
3. The momentum of building something meaningful.

### Evening Reflection
Accomplished the planned deep work block and stayed disciplined with time blocks.`,
        createdAt: now - 3600000,
      },
      {
        id: "journal-sample-2",
        date: d1,
        mood: "good",
        body: `### Daily Review
Solid training session in the morning. Made steady progress on 10K running milestones.

### Key Insight
Consistency compounds faster than intensity. Protecting the daily routine is the highest ROI habit.`,
        createdAt: now - 86400000,
      },
    ],
  };
}

export function normalizeJournalEntry(raw: unknown): JournalEntry {
  const e = (raw && typeof raw === "object" ? raw : {}) as Partial<JournalEntry>;
  const id = typeof e.id === "string" && e.id.trim() ? e.id : crypto.randomUUID();
  const date = typeof e.date === "string" && e.date ? e.date : todayISO();
  const mood: Mood =
    typeof e.mood === "string" && e.mood in MOOD_META ? (e.mood as Mood) : "good";
  const body = typeof e.body === "string" ? e.body : "";
  const createdAt = typeof e.createdAt === "number" ? e.createdAt : Date.now();
  return { id, date, mood, body, createdAt };
}

export function normalizeJournalState(current: unknown): JournalPersistedState {
  if (!current || typeof current !== "object") {
    return createDefaultJournalState();
  }
  const s = current as Partial<JournalPersistedState>;
  return {
    entries: Array.isArray(s.entries) ? s.entries.map(normalizeJournalEntry) : [],
  };
}

/**
 * Pure operation to add a journal entry.
 */
export function addEntryOperation(
  current: JournalPersistedState | null | undefined,
  entry: JournalEntry,
): JournalPersistedState {
  const base = normalizeJournalState(current);
  return {
    entries: [entry, ...base.entries],
  };
}

/**
 * Pure operation to update an existing journal entry.
 */
export function updateEntryOperation(
  current: JournalPersistedState | null | undefined,
  id: string,
  patch: Partial<Pick<JournalEntry, "mood" | "body" | "date">>,
): JournalPersistedState {
  const base = normalizeJournalState(current);
  return {
    entries: base.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  };
}

/**
 * Pure operation to delete a journal entry.
 */
export function deleteEntryOperation(
  current: JournalPersistedState | null | undefined,
  id: string,
): JournalPersistedState {
  const base = normalizeJournalState(current);
  return {
    entries: base.entries.filter((e) => e.id !== id),
  };
}
