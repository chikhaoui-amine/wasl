import { fromISO, todayISO, toISO } from "@/lib/date";
import type { GoalsPersistedState } from "../../types";

export interface Milestone {
  id: string;
  title: string;
  done: boolean;
}

export type GoalType = "north_star" | "yearly_outcome" | "monthly_outcome" | "challenge";
export type GoalStatus = "active" | "paused" | "completed" | "later";

export interface NorthStarPreset {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

export const NORTH_STAR_PRESETS: NorthStarPreset[] = [
  { id: "health_fitness", title: "Health & Fitness", description: "Physical vitality, conditioning & well-being", icon: "Activity", color: "#37c9b7" },
  { id: "career_work", title: "Career & Work", description: "Professional growth, meaningful work & leadership", icon: "Briefcase", color: "#7c9cf5" },
  { id: "finance_wealth", title: "Finance & Wealth", description: "Financial security, investing & independence", icon: "Wallet", color: "#5fb36a" },
  { id: "personal_growth", title: "Personal Growth", description: "Mindset, self-discipline & continuous learning", icon: "Sparkles", color: "#b57edc" },
  { id: "relationships_family", title: "Relationships & Family", description: "Deep connections, family & community", icon: "Users", color: "#d95f6a" },
  { id: "mindfulness_balance", title: "Mindfulness & Well-being", description: "Inner peace, reflection & balanced living", icon: "Compass", color: "#e0a34a" },
  { id: "creativity_craft", title: "Creativity & Craft", description: "Creative expression, design, art & building", icon: "Palette", color: "#f472b6" },
];

export const mapLegacyCategoryToNorthStar = (catId?: string): string => {
  if (!catId) return "personal_growth";
  const lower = catId.toLowerCase().trim();
  if (lower === "career" || lower === "work" || lower === "career_work" || lower === "ai_tech" || lower === "ai & technology") return "career_work";
  if (lower === "finance" || lower === "wealth" || lower === "money" || lower === "finance_wealth" || lower === "business_finance" || lower === "business & financial freedom" || lower === "business") return "finance_wealth";
  if (lower === "health" || lower === "fitness" || lower === "health_fitness" || lower === "athletic_body" || lower === "athletic body & performance") return "health_fitness";
  if (lower === "personal" || lower === "growth" || lower === "personal_growth" || lower === "personal_capability" || lower === "personal capability") return "personal_growth";
  if (lower === "relationships" || lower === "social" || lower === "romantic" || lower === "family" || lower === "relationships_family" || lower === "social_romantic" || lower === "social & romantic life") return "relationships_family";
  if (lower === "adventure" || lower === "adventure & experiences" || lower === "mindfulness" || lower === "well-being" || lower === "wellbeing" || lower === "balance" || lower === "mindfulness_balance") return "mindfulness_balance";
  if (lower === "creativity" || lower === "art" || lower === "craft" || lower === "creativity_craft") return "creativity_craft";
  const preset = NORTH_STAR_PRESETS.find((n) => n.id === lower || n.title.toLowerCase() === lower);
  if (preset) return preset.id;
  return "personal_growth";
};

export const getNorthStarMeta = (nsIdOrName?: string, goalsList?: Goal[]): NorthStarPreset => {
  if (!nsIdOrName) return NORTH_STAR_PRESETS[3];
  const target = nsIdOrName.trim().toLowerCase();

  const preset = NORTH_STAR_PRESETS.find(
    (n) => n.id === target || n.title.toLowerCase() === target,
  );
  if (preset) return preset;

  const mappedId = mapLegacyCategoryToNorthStar(nsIdOrName);
  const mappedPreset = NORTH_STAR_PRESETS.find((n) => n.id === mappedId);
  if (mappedPreset && mappedId !== "personal_growth") return mappedPreset;

  const customNS = goalsList?.find(
    (g) => (g.type === "north_star" || g.id === nsIdOrName) && (g.id === nsIdOrName || g.title.toLowerCase() === target),
  );
  if (customNS) {
    return {
      id: customNS.id,
      title: customNS.title,
      description: customNS.why || "Permanent life direction",
      icon: "Sparkles",
      color: customNS.customCategoryColor || "#b57edc",
    };
  }

  return mappedPreset ?? NORTH_STAR_PRESETS[3];
};

export interface GoalCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  isPreset?: boolean;
}

export const PRESET_CATEGORIES: GoalCategory[] = [
  { id: "career", label: "Career & Work", icon: "Briefcase", color: "#7c9cf5", isPreset: true },
  { id: "health", label: "Health & Fitness", icon: "Activity", color: "#37c9b7", isPreset: true },
  { id: "finance", label: "Finance & Wealth", icon: "Wallet", color: "#5fb36a", isPreset: true },
  { id: "personal", label: "Personal Growth", icon: "Sparkles", color: "#b57edc", isPreset: true },
  { id: "faith", label: "Faith", icon: "Moon", color: "#e0a34a", isPreset: true },
  { id: "relationships", label: "Relationships", icon: "Users", color: "#d95f6a", isPreset: true },
  ...NORTH_STAR_PRESETS.map((n) => ({
    id: n.id,
    label: n.title,
    icon: n.icon,
    color: n.color,
    isPreset: true,
  })),
];

export const getCategoryMeta = (catIdOrName: string, customColor?: string): GoalCategory => {
  const lower = (catIdOrName || "").toLowerCase().trim();
  const foundLegacy = PRESET_CATEGORIES.find(
    (c) => c.id === lower || c.label.toLowerCase() === lower,
  );
  if (foundLegacy) {
    return { ...foundLegacy, color: customColor || foundLegacy.color };
  }
  const foundNS = NORTH_STAR_PRESETS.find(
    (n) => n.id === lower || n.title.toLowerCase() === lower,
  );
  if (foundNS) {
    return {
      id: foundNS.id,
      label: foundNS.title,
      icon: foundNS.icon,
      color: customColor || foundNS.color,
      isPreset: true,
    };
  }
  return {
    id: lower,
    label: catIdOrName,
    icon: "Folder",
    color: customColor || "#9aa0aa",
    isPreset: false,
  };
};

export interface Goal {
  id: string;
  title: string;
  why?: string;
  plan: string;
  milestones: Milestone[];
  start?: string;
  end?: string;
  targetYear?: number;
  targetMonth?: string;
  manualProgress: number;
  completed: boolean;
  category: string;
  customCategoryColor?: string;
  type?: GoalType;
  status?: GoalStatus;
  northStarId?: string;
  isCurrentFocus?: boolean;
  linkedOutcomeId?: string;
}

export interface GoalInput {
  title: string;
  why?: string;
  start?: string;
  end?: string;
  targetYear?: number;
  targetMonth?: string;
  manualProgress?: number;
  category?: string;
  customCategoryColor?: string;
  type?: GoalType;
  status?: GoalStatus;
  northStarId?: string;
  isCurrentFocus?: boolean;
  linkedOutcomeId?: string;
  milestones?: Milestone[];
}

export function createDefaultGoalsState(): GoalsPersistedState {
  const currentYear = new Date().getFullYear();
  return {
    goals: [
      {
        id: "goal-sample-1",
        title: "Run a 10K in under 50 minutes",
        why: "Build cardiovascular endurance, discipline, and peak physical energy.",
        plan: "Structured zone 2 base running, weekly intervals, and progressive long runs.",
        milestones: [
          { id: "m-10k-1", title: "Build 5K aerobic base (3x/week)", done: true },
          { id: "m-10k-2", title: "Interval track session on Tuesdays", done: true },
          { id: "m-10k-3", title: "Complete 8K pacing simulation", done: false },
          { id: "m-10k-4", title: "10K Race Day execution", done: false },
        ],
        manualProgress: 50,
        completed: false,
        category: "health_fitness",
        type: "yearly_outcome",
        status: "active",
        northStarId: "health_fitness",
        isCurrentFocus: true,
        targetYear: currentYear,
        start: `${currentYear}-01-01`,
        end: `${currentYear}-12-31`,
      },
      {
        id: "goal-sample-2",
        title: "Master Personal Operating System Architecture",
        why: "Create a seamless, unified digital hub for life, work, health, and learning.",
        plan: "Iterative building: offline local sync, MCP AI integration, and domain convergence.",
        milestones: [
          { id: "m-wasl-1", title: "Architecture & schema design", done: true },
          { id: "m-wasl-2", title: "Local-first sync & IndexedDB storage", done: true },
          { id: "m-wasl-3", title: "MCP AI native workflows & tooling", done: true },
          { id: "m-wasl-4", title: "Complete life system synthesis & routines", done: false },
        ],
        manualProgress: 75,
        completed: false,
        category: "career_work",
        type: "yearly_outcome",
        status: "active",
        northStarId: "career_work",
        isCurrentFocus: true,
        targetYear: currentYear,
        start: `${currentYear}-01-01`,
        end: `${currentYear}-12-31`,
      },
      {
        id: "goal-sample-3",
        title: "Read 12 Foundational Books & Build Knowledge Base",
        why: "Expand mental models across systems thinking, biology, philosophy, and craft.",
        plan: "Read 20 pages daily, capture key insights into Notes, synthesize into Topics.",
        milestones: [
          { id: "m-read-1", title: "Read 3 books on systems & deep work", done: true },
          { id: "m-read-2", title: "Read 3 books on biology & endurance", done: false },
          { id: "m-read-3", title: "Synthesize top principles into Notes", done: false },
        ],
        manualProgress: 33,
        completed: false,
        category: "personal_growth",
        type: "yearly_outcome",
        status: "active",
        northStarId: "personal_growth",
        isCurrentFocus: false,
        targetYear: currentYear,
        start: `${currentYear}-01-01`,
        end: `${currentYear}-12-31`,
      },
    ],
  };
}

export function normalizeGoal(raw: unknown): Goal {
  if (!raw || typeof raw !== "object") {
    return {
      id: crypto.randomUUID(),
      title: "Untitled Goal",
      plan: "",
      milestones: [],
      manualProgress: 0,
      completed: false,
      category: "personal_growth",
      type: "yearly_outcome",
      status: "active",
      northStarId: "personal_growth",
      isCurrentFocus: false,
    };
  }

  const g = raw as Partial<Goal>;
  const nsId = g.northStarId || mapLegacyCategoryToNorthStar(g.category);

  return {
    id: typeof g.id === "string" && g.id ? g.id : crypto.randomUUID(),
    title: typeof g.title === "string" ? g.title : "Untitled Goal",
    why: typeof g.why === "string" ? g.why : undefined,
    plan: typeof g.plan === "string" ? g.plan : "",
    milestones: Array.isArray(g.milestones)
      ? g.milestones.map((m) => ({
          id: typeof m?.id === "string" && m.id ? m.id : crypto.randomUUID(),
          title: typeof m?.title === "string" ? m.title : "Milestone",
          done: typeof m?.done === "boolean" ? m.done : false,
        }))
      : [],
    start: typeof g.start === "string" ? g.start : undefined,
    end: typeof g.end === "string" ? g.end : undefined,
    targetYear: typeof g.targetYear === "number" ? g.targetYear : undefined,
    targetMonth: typeof g.targetMonth === "string" ? g.targetMonth : undefined,
    manualProgress: typeof g.manualProgress === "number" ? Math.max(0, Math.min(100, g.manualProgress)) : 0,
    completed: typeof g.completed === "boolean" ? g.completed : g.status === "completed",
    category: nsId,
    customCategoryColor: typeof g.customCategoryColor === "string" ? g.customCategoryColor : undefined,
    type: (g.type as string) === "project" ? "yearly_outcome" : (g.type ?? "yearly_outcome"),
    status: g.status ?? (g.completed ? "completed" : "active"),
    northStarId: nsId,
    isCurrentFocus: typeof g.isCurrentFocus === "boolean" ? g.isCurrentFocus : false,
    linkedOutcomeId: typeof g.linkedOutcomeId === "string" ? g.linkedOutcomeId : undefined,
  };
}

export function normalizeGoalsState(raw: unknown): GoalsPersistedState {
  if (!raw || typeof raw !== "object") {
    return createDefaultGoalsState();
  }
  const state = raw as Partial<GoalsPersistedState>;
  return {
    goals: Array.isArray(state.goals) ? state.goals.map(normalizeGoal) : [],
  };
}

export function addGoalOperation(current: GoalsPersistedState, newGoal: Goal): GoalsPersistedState {
  return {
    ...current,
    goals: [...current.goals, normalizeGoal(newGoal)],
  };
}

export function updateGoalOperation(
  current: GoalsPersistedState,
  id: string,
  patch: Partial<Omit<Goal, "id">>,
): GoalsPersistedState {
  return {
    ...current,
    goals: current.goals.map((g) => {
      if (g.id !== id) return g;
      const updated = { ...g, ...patch, milestones: patch.milestones ?? g.milestones ?? [] };
      if (patch.status) {
        updated.completed = patch.status === "completed";
      } else if (patch.completed !== undefined) {
        updated.status = patch.completed ? "completed" : "active";
      }
      if (patch.category && !patch.northStarId) {
        updated.northStarId = mapLegacyCategoryToNorthStar(patch.category);
      }
      return normalizeGoal(updated);
    }),
  };
}

export function deleteGoalOperation(current: GoalsPersistedState, id: string): GoalsPersistedState {
  return {
    ...current,
    goals: current.goals.filter((g) => g.id !== id),
  };
}

export function addMilestoneOperation(
  current: GoalsPersistedState,
  goalId: string,
  milestone: Milestone,
): GoalsPersistedState {
  return {
    ...current,
    goals: current.goals.map((g) =>
      g.id === goalId
        ? { ...g, milestones: [...(g.milestones ?? []), milestone] }
        : g,
    ),
  };
}

export function updateMilestoneOperation(
  current: GoalsPersistedState,
  goalId: string,
  id: string,
  title: string,
): GoalsPersistedState {
  return {
    ...current,
    goals: current.goals.map((g) =>
      g.id === goalId
        ? {
            ...g,
            milestones: (g.milestones ?? []).map((m) =>
              m.id === id ? { ...m, title: title.trim() } : m,
            ),
          }
        : g,
    ),
  };
}

export function toggleMilestoneOperation(
  current: GoalsPersistedState,
  goalId: string,
  id: string,
): GoalsPersistedState {
  return {
    ...current,
    goals: current.goals.map((g) =>
      g.id === goalId
        ? {
            ...g,
            milestones: (g.milestones ?? []).map((m) =>
              m.id === id ? { ...m, done: !m.done } : m,
            ),
          }
        : g,
    ),
  };
}

export function deleteMilestoneOperation(
  current: GoalsPersistedState,
  goalId: string,
  id: string,
): GoalsPersistedState {
  return {
    ...current,
    goals: current.goals.map((g) =>
      g.id === goalId
        ? { ...g, milestones: (g.milestones ?? []).filter((m) => m.id !== id) }
        : g,
    ),
  };
}

export function moveMilestoneOperation(
  current: GoalsPersistedState,
  goalId: string,
  id: string,
  direction: "up" | "down",
): GoalsPersistedState {
  return {
    ...current,
    goals: current.goals.map((g) => {
      if (g.id !== goalId) return g;
      const ms = [...(g.milestones ?? [])];
      const idx = ms.findIndex((m) => m.id === id);
      if (idx === -1) return g;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= ms.length) return g;
      const [item] = ms.splice(idx, 1);
      ms.splice(targetIdx, 0, item);
      return { ...g, milestones: ms };
    }),
  };
}

export function reorderMilestonesOperation(
  current: GoalsPersistedState,
  goalId: string,
  milestones: Milestone[],
): GoalsPersistedState {
  return {
    ...current,
    goals: current.goals.map((g) => (g.id === goalId ? { ...g, milestones } : g)),
  };
}

export function toggleGoalDoneOperation(current: GoalsPersistedState, id: string): GoalsPersistedState {
  return {
    ...current,
    goals: current.goals.map((g) => {
      if (g.id !== id) return g;
      const nextCompleted = !g.completed;
      return {
        ...g,
        completed: nextCompleted,
        status: nextCompleted ? "completed" : "active",
      };
    }),
  };
}

/* ---------- Calculations & Helpers ---------- */

export const quarterBounds = (d = new Date()) => {
  const q = Math.floor(d.getMonth() / 3);
  return {
    start: toISO(new Date(d.getFullYear(), q * 3, 1)),
    end: toISO(new Date(d.getFullYear(), q * 3 + 3, 0)),
  };
};

export const monthBounds = (d = new Date()) => ({
  start: toISO(new Date(d.getFullYear(), d.getMonth(), 1)),
  end: toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
});

export const yearBounds = (d = new Date()) => ({
  start: toISO(new Date(d.getFullYear(), 0, 1)),
  end: toISO(new Date(d.getFullYear(), 11, 31)),
});

export const nextMilestone = (goal: Goal): Milestone | null => {
  const milestones = goal.milestones ?? [];
  return milestones.find((m) => !m.done) ?? null;
};

export const timelineProgress = (goal: Goal): number | null => {
  if (!goal.start || !goal.end) return null;
  const s = fromISO(goal.start).getTime();
  const e = fromISO(goal.end).getTime();
  const now = fromISO(todayISO()).getTime();
  if (e <= s) return 0;
  if (now <= s) return 0;
  if (now >= e) return 100;
  return Math.min(100, Math.max(0, Math.round(((now - s) / (e - s)) * 100)));
};

export const milestoneProgress = (goal: Goal): number | null => {
  const milestones = goal.milestones ?? [];
  if (milestones.length === 0) return null;
  const doneCount = milestones.filter((m) => m.done).length;
  return Math.round((doneCount / milestones.length) * 100);
};

export const goalProgress = (goal: Goal) => {
  if (goal.completed || goal.status === "completed") return 100;
  const m = milestoneProgress(goal);
  if (m !== null) return m;
  return goal.manualProgress ?? 0;
};

export const categoryProgress = (
  goals: Goal[],
  catId: string,
) => {
  const catGoals = goals.filter(
    (g) =>
      g.category.toLowerCase() === catId.toLowerCase() ||
      g.northStarId?.toLowerCase() === catId.toLowerCase() ||
      mapLegacyCategoryToNorthStar(g.category) === catId.toLowerCase(),
  );
  if (catGoals.length === 0) return 0;
  const totalProg = catGoals.reduce((acc, g) => acc + goalProgress(g), 0);
  return Math.round(totalProg / catGoals.length);
};

export const daysLeft = (goal: Goal) => {
  if (!goal.end) return null;
  const endMs = fromISO(goal.end).getTime();
  const todayMs = fromISO(todayISO()).getTime();

  let startMs = todayMs;
  if (goal.start) {
    const startIsoMs = fromISO(goal.start).getTime();
    if (startIsoMs > todayMs) {
      startMs = startIsoMs;
    }
  }

  return Math.max(0, Math.round((endMs - startMs) / 86400000));
};

export const elapsedPct = (goal: Goal) => {
  if (!goal.start || !goal.end) return null;
  const s = fromISO(goal.start).getTime();
  const e = fromISO(goal.end).getTime();
  const now = fromISO(todayISO()).getTime();
  if (e <= s) return null;
  return Math.min(100, Math.max(0, Math.round(((now - s) / (e - s)) * 100)));
};

export type TrackState = "on-track" | "behind" | "done" | null;

export const trackState = (goal: Goal, progress: number): TrackState => {
  if (progress >= 100 || goal.completed || goal.status === "completed") return "done";
  const elapsed = elapsedPct(goal);
  if (elapsed === null) return null;
  return progress + 7 >= elapsed ? "on-track" : "behind";
};

export const periodLabel = (goal: Goal) => {
  if (!goal.start || !goal.end) return "ongoing";
  const fmt = (iso: string) =>
    fromISO(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(goal.start)} → ${fmt(goal.end)}`;
};

export type GoalPeriodKind = "someday" | "year" | "month" | "other";

export const goalPeriodKind = (goal: Goal): GoalPeriodKind => {
  if (!goal.start && !goal.end) return "someday";
  if (!goal.start || !goal.end) return "other";
  const y = yearBounds(fromISO(goal.start));
  if (goal.start === y.start && goal.end === y.end) return "year";
  const m = monthBounds(fromISO(goal.start));
  if (goal.start === m.start && goal.end === m.end) return "month";
  return "other";
};

export const goalYear = (goal: Goal): number | null => {
  const iso = goal.start ?? goal.end;
  return iso ? fromISO(iso).getFullYear() : null;
};

export const goalYearSpanLabel = (goal: Goal): string => {
  const startY = goal.start ? fromISO(goal.start).getFullYear() : (goal.targetYear || goalYear(goal));
  const endY = goal.end ? fromISO(goal.end).getFullYear() : (goal.targetYear || goalYear(goal));
  if (!startY && !endY) return "";
  if (startY && endY && startY !== endY) {
    return `${String(startY).slice(-2)}/${String(endY).slice(-2)}`;
  }
  return startY ? String(startY) : endY ? String(endY) : "";
};
