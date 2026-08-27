import { addDays, streakFrom, todayISO } from "@/lib/date";
import { MOOD_ORDER, type Mood, type JournalEntry } from "./types";

export const journalStreak = (entries: JournalEntry[]) =>
  streakFrom(new Set(entries.map((e) => e.date)));

export const moodDistribution = (entries: JournalEntry[], days = 14) => {
  const cutoff = addDays(todayISO(), -days);
  const dist = Object.fromEntries(MOOD_ORDER.map((m) => [m, 0])) as Record<Mood, number>;
  (entries || []).filter((e) => e && e.date >= cutoff).forEach((e) => {
    if (dist[e.mood] !== undefined) dist[e.mood]++;
  });
  return dist;
};
