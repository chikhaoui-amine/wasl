import { Flame, Smile, Meh, CloudDrizzle, CloudRain, type LucideIcon } from "lucide-react";

export type Mood = "great" | "good" | "okay" | "low" | "rough";

export const MOOD_META: Record<Mood, { label: string; icon: LucideIcon; color: string }> = {
  great: { label: "Great", icon: Flame, color: "var(--success)" },
  good: { label: "Good", icon: Smile, color: "var(--accent)" },
  okay: { label: "Okay", icon: Meh, color: "var(--muted)" },
  low: { label: "Low", icon: CloudDrizzle, color: "var(--warn)" },
  rough: { label: "Rough", icon: CloudRain, color: "var(--danger)" },
};

export const MOOD_ORDER: Mood[] = ["great", "good", "okay", "low", "rough"];

export function getMoodMeta(mood: unknown): { label: string; icon: LucideIcon; color: string } {
  if (typeof mood === "string" && mood in MOOD_META) {
    return MOOD_META[mood as Mood];
  }
  return MOOD_META.good;
}

export interface JournalEntry {
  id: string;
  date: string; // ISO day
  mood: Mood;
  body: string;
  createdAt: number;
}
