import type { IconKey } from "@/lib/icons";

export interface Habit {
  id: string;
  name: string;
  icon: IconKey;
  /** days per week you aim for; 7 = daily */
  targetPerWeek: number;
  color: string;
  log: Record<string, boolean>; // ISO day -> done
  createdAt: string;
}

export interface HabitInput {
  name: string;
  icon: IconKey;
  targetPerWeek: number;
  color: string;
}
