"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Archive,
  LayoutGrid,
  List,
  Sparkles,
  RotateCcw,
  Target,
} from "lucide-react";
import {
  useGoalsData,
  NORTH_STAR_PRESETS,
  getNorthStarMeta,
  goalProgress,
  goalYear,
  type Goal,
  type GoalType,
} from "@/lib/data/domains/goals";
import { useTasksData } from "@/lib/data/domains/tasks";
import { GoalSummaryStrip } from "@/components/goals/GoalSummaryStrip";
import { NorthStarFilterStrip, type NorthStarItem } from "@/components/goals/NorthStarFilterStrip";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalListRow } from "@/components/goals/GoalListRow";
import { GoalForm } from "@/components/forms/GoalForm";
import { GoalDetail } from "@/components/details/GoalDetail";
import { Modal } from "@/components/ui/Modal";
import { Hydrate } from "@/lib/hydration";
import { cn } from "@/lib/utils";

export default function GoalsPage() {
  const { goals, addGoal, deleteGoal, toggleMilestone } = useGoalsData();
  const { tasks } = useTasksData();

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedNorthStarId, setSelectedNorthStarId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [creating, setCreating] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>(undefined);
  const [initialType, setInitialType] = useState<GoalType>("yearly_outcome");
  const [initialNorthStarId, setInitialNorthStarId] = useState<string | undefined>(undefined);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [hiddenNorthStars, setHiddenNorthStars] = useState<string[]>([]);
  const [deletingNorthStar, setDeletingNorthStar] = useState<{
    id: string;
    title: string;
    isUserCreated: boolean;
    goalCount: number;
  } | null>(null);

  // Load hidden presets from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("wasl_hidden_north_stars");
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe initial load from localStorage
        setHiddenNorthStars(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const hidePresetNorthStar = (presetId: string) => {
    setHiddenNorthStars((prev) => {
      const next = prev.includes(presetId) ? prev : [...prev, presetId];
      try {
        localStorage.setItem("wasl_hidden_north_stars", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const restoreHiddenPresets = () => {
    setHiddenNorthStars([]);
    try {
      localStorage.removeItem("wasl_hidden_north_stars");
    } catch {
      // ignore
    }
  };

  const confirmDeleteNorthStar = () => {
    if (!deletingNorthStar) return;
    if (deletingNorthStar.isUserCreated) {
      deleteGoal(deletingNorthStar.id);
    } else {
      hidePresetNorthStar(deletingNorthStar.id);
    }
    if (selectedNorthStarId === deletingNorthStar.id) {
      setSelectedNorthStarId(null);
    }
    setDeletingNorthStar(null);
  };

  const editNorthStar = (ns: { id: string }) => {
    const found = goals.find((g) => g.id === ns.id && g.type === "north_star");
    if (found) {
      setEditingGoal(found);
      setInitialType("north_star");
      setInitialNorthStarId(undefined);
      setCreating(true);
    }
  };

  // User's custom North Stars
  const userNorthStars = useMemo(() => goals.filter((g) => g.type === "north_star"), [goals]);

  // Combined list of North Stars for display
  const allNorthStarsMeta = useMemo(() => {
    return [
      ...userNorthStars.map((g) => ({
        id: g.id,
        title: g.title,
        description: g.why || "Lifetime direction & guiding principle",
        icon: "Compass",
        color: g.customCategoryColor || "#b57edc",
        isUserCreated: true,
      })),
      ...NORTH_STAR_PRESETS.filter(
        (p) =>
          !hiddenNorthStars.includes(p.id) &&
          !userNorthStars.some((u) => u.id === p.id || u.title.toLowerCase() === p.title.toLowerCase()),
      ).map((p) => ({
        ...p,
        isUserCreated: false,
      })),
    ];
  }, [userNorthStars, hiddenNorthStars]);

  // Helper to check if a goal is a yearly outcome
  const isYearlyGoal = (g: Goal) => {
    if (g.type && g.type !== "yearly_outcome") return false;
    return true;
  };

  // Active vs Inactive Yearly Goals
  const activeGoals = useMemo(
    () =>
      goals.filter(
        (g) =>
          isYearlyGoal(g) &&
          g.status !== "completed" &&
          g.status !== "paused" &&
          g.status !== "later" &&
          !g.completed,
      ),
    [goals],
  );

  const inactiveGoals = useMemo(
    () =>
      goals.filter(
        (g) =>
          isYearlyGoal(g) &&
          (g.status === "completed" || g.status === "paused" || g.status === "later" || g.completed),
      ),
    [goals],
  );

  // Filter active goals by selected year
  const yearActiveGoals = useMemo(() => {
    return activeGoals.filter((g) => {
      const startY = g.start ? new Date(g.start).getFullYear() : (g.targetYear || goalYear(g));
      const endY = g.end ? new Date(g.end).getFullYear() : (g.targetYear || goalYear(g));
      if (!startY && !endY) return true;
      if (startY && endY) {
        return selectedYear >= startY && selectedYear <= endY;
      }
      const y = startY || endY;
      return y === selectedYear;
    });
  }, [activeGoals, selectedYear]);

  const matchesNorthStar = (g: Goal, nsId: string) => {
    if (g.northStarId && g.northStarId.toLowerCase() === nsId.toLowerCase()) return true;
    if (g.category && g.category.toLowerCase() === nsId.toLowerCase()) return true;
    const meta = getNorthStarMeta(g.northStarId || g.category);
    if (meta.id.toLowerCase() === nsId.toLowerCase() || meta.title.toLowerCase() === nsId.toLowerCase())
      return true;
    return false;
  };

  // North Stars with counts for the filter chips
  const northStarsWithCount: NorthStarItem[] = useMemo(() => {
    return allNorthStarsMeta
      .map((ns) => {
        const count = yearActiveGoals.filter((g) => matchesNorthStar(g, ns.id)).length;
        return {
          ...ns,
          count,
        };
      })
      .filter((ns) => {
        // Show if user-created, or has goals in the current year, or if no custom north stars exist
        if (ns.isUserCreated) return true;
        if (ns.count > 0) return true;
        if (userNorthStars.length === 0) return true;
        return false;
      });
  }, [allNorthStarsMeta, yearActiveGoals, userNorthStars]);

  // Displayed goals after applying North Star filter
  const displayedGoals = useMemo(() => {
    if (!selectedNorthStarId) return yearActiveGoals;
    return yearActiveGoals.filter((g) => matchesNorthStar(g, selectedNorthStarId));
  }, [yearActiveGoals, selectedNorthStarId]);

  // Summary Metrics calculations
  const summaryMetrics = useMemo(() => {
    const totalGoals = yearActiveGoals.length;
    const avgProg =
      totalGoals > 0
        ? Math.round(yearActiveGoals.reduce((sum, g) => sum + goalProgress(g), 0) / totalGoals)
        : 0;

    let totalM = 0;
    let doneM = 0;
    for (const g of yearActiveGoals) {
      if (g.milestones) {
        totalM += g.milestones.length;
        doneM += g.milestones.filter((m) => m.done).length;
      }
    }

    return {
      activeGoalsCount: totalGoals,
      averageProgress: avgProg,
      completedMilestones: doneM,
      totalMilestones: totalM,
    };
  }, [yearActiveGoals]);

  // Linked tasks lookup map
  const taskCountByGoalId = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (t.goalId) {
        map.set(t.goalId, (map.get(t.goalId) || 0) + 1);
      }
    }
    return map;
  }, [tasks]);

  const openCreateModal = (type: GoalType = "yearly_outcome", northStarId?: string) => {
    setEditingGoal(undefined);
    setInitialType(type);
    setInitialNorthStarId(northStarId || selectedNorthStarId || undefined);
    setCreating(true);
  };

  const createPresetNorthStar = (preset: (typeof NORTH_STAR_PRESETS)[0]) => {
    addGoal({
      title: preset.title,
      why: preset.description,
      type: "north_star",
      category: "north_star",
      customCategoryColor: preset.color,
      status: "active",
    });
  };

  return (
    <Hydrate>
      <div className="space-y-6 sm:space-y-7 pb-12">
        {/* Top Header Bar */}
        <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4 sm:pb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">Life Directions & Goals</h1>
            <p className="text-xs sm:text-[13px] text-muted">
              Lifetime North Stars and actionable yearly outcomes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Year Switcher */}
            <div className="flex items-center gap-1 rounded-full border border-border/80 bg-surface-2/90 px-2.5 py-1 text-xs shadow-xs">
              <button
                onClick={() => setSelectedYear((y) => y - 1)}
                className="p-0.5 rounded-full text-muted hover:text-accent hover:bg-surface-hover transition-colors"
                title="Previous Year"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="font-display text-xs sm:text-sm font-bold text-accent px-1 tabular-nums">
                {selectedYear}
              </span>
              <button
                onClick={() => setSelectedYear((y) => y + 1)}
                className="p-0.5 rounded-full text-muted hover:text-accent hover:bg-surface-hover transition-colors"
                title="Next Year"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* View Mode Toggle (Grid / List) */}
            <div className="flex items-center rounded-full border border-border/80 bg-surface-2/90 p-0.5 shadow-xs">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-1.5 rounded-full transition-colors",
                  viewMode === "grid" ? "bg-accent text-white shadow-xs" : "text-muted hover:text-text",
                )}
                title="Grid View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-1.5 rounded-full transition-colors",
                  viewMode === "list" ? "bg-accent text-white shadow-xs" : "text-muted hover:text-text",
                )}
                title="List View"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* + Add North Star */}
            <button
              onClick={() => openCreateModal("north_star")}
              className="flex items-center gap-1 sm:gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-text hover:border-border-strong transition-all"
            >
              <Plus className="h-3.5 w-3.5" /> Add North Star
            </button>

            {/* + New Goal */}
            <button
              onClick={() => openCreateModal("yearly_outcome")}
              className="btn-hero flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-full px-3.5 sm:px-4 py-1.5 text-xs sm:text-[13px] font-semibold"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> New Goal
            </button>
          </div>
        </div>

        {/* Minimal Executive Summary Strip */}
        <GoalSummaryStrip
          activeGoalsCount={summaryMetrics.activeGoalsCount}
          averageProgress={summaryMetrics.averageProgress}
          completedMilestones={summaryMetrics.completedMilestones}
          totalMilestones={summaryMetrics.totalMilestones}
        />

        {/* North Star Filter Strip (Chips Bar) */}
        <NorthStarFilterStrip
          northStars={northStarsWithCount}
          selectedId={selectedNorthStarId}
          totalGoalsCount={yearActiveGoals.length}
          onSelect={(id) => setSelectedNorthStarId(id)}
          onAddNorthStar={() => openCreateModal("north_star")}
          onEditNorthStar={(ns) => editNorthStar(ns)}
          onDeleteNorthStar={(ns) =>
            setDeletingNorthStar({
              id: ns.id,
              title: ns.title,
              isUserCreated: !!ns.isUserCreated,
              goalCount: ns.count,
            })
          }
        />

        {/* Main Goals Section */}
        <section className="space-y-4">
          {displayedGoals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-surface/40 p-8 sm:p-12 text-center space-y-3">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft/30 text-accent">
                <Target className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-base font-bold text-text">
                  {selectedNorthStarId
                    ? "No goals under this direction yet"
                    : `No active goals for ${selectedYear}`}
                </h3>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  {selectedNorthStarId
                    ? "Define high-impact outcomes aligned with this North Star to start tracking progress."
                    : "Create your first actionable yearly goal to bridge the gap between vision and reality."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openCreateModal("yearly_outcome", selectedNorthStarId || undefined)}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-accent/90 transition-colors shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Goal</span>
              </button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
              {displayedGoals.map((goal) => {
                const nsId = goal.northStarId || goal.category;
                const nsMeta = allNorthStarsMeta.find((n) => n.id === nsId) || getNorthStarMeta(nsId);
                const taskCount = taskCountByGoalId.get(goal.id) || 0;

                return (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    northStarMeta={{
                      id: nsMeta.id,
                      title: nsMeta.title,
                      color: nsMeta.color,
                    }}
                    linkedTaskCount={taskCount}
                    onOpen={() => setOpenId(goal.id)}
                    onToggleMilestone={(gId, mId) => toggleMilestone(gId, mId)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {displayedGoals.map((goal) => {
                const nsId = goal.northStarId || goal.category;
                const nsMeta = allNorthStarsMeta.find((n) => n.id === nsId) || getNorthStarMeta(nsId);
                const taskCount = taskCountByGoalId.get(goal.id) || 0;

                return (
                  <GoalListRow
                    key={goal.id}
                    goal={goal}
                    northStarMeta={{
                      id: nsMeta.id,
                      title: nsMeta.title,
                      color: nsMeta.color,
                    }}
                    linkedTaskCount={taskCount}
                    onOpen={() => setOpenId(goal.id)}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Preset suggestions banner when few or no custom North Stars */}
        {userNorthStars.length < 3 && (
          <div className="rounded-xl border border-dashed border-accent/30 bg-accent-soft/10 p-3 text-center text-xs text-muted flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent shrink-0" />
              <span>
                Quick-add lifetime directions:
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 justify-center">
              {NORTH_STAR_PRESETS.filter(
                (p) => !userNorthStars.some((u) => u.title.toLowerCase() === p.title.toLowerCase()),
              )
                .slice(0, 4)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => createPresetNorthStar(p)}
                    className="rounded-pill border border-border bg-surface px-2.5 py-0.5 text-[11px] font-medium text-text hover:border-accent hover:text-accent transition-colors"
                  >
                    + {p.title}
                  </button>
                ))}
              {hiddenNorthStars.length > 0 && (
                <button
                  type="button"
                  onClick={restoreHiddenPresets}
                  className="rounded-pill border border-accent/40 bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-accent hover:bg-accent-soft transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Restore presets ({hiddenNorthStars.length})
                </button>
              )}
            </div>
          </div>
        )}

        {/* COMPLETED & ARCHIVED SECTION */}
        {inactiveGoals.length > 0 && (
          <section className="space-y-3 pt-4 border-t border-border/60">
            <button
              onClick={() => setShowInactive(!showInactive)}
              className="flex items-center gap-2 text-xs sm:text-[13px] font-bold text-muted hover:text-text transition-colors"
            >
              {showInactive ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Archive className="h-4 w-4 text-faint" /> Completed & Archived ({inactiveGoals.length})
            </button>

            {showInactive && (
              <div className="space-y-2 pt-2">
                {inactiveGoals.map((g) => {
                  const nsId = g.northStarId || g.category;
                  const nsMeta = allNorthStarsMeta.find((n) => n.id === nsId) || getNorthStarMeta(nsId);
                  const taskCount = taskCountByGoalId.get(g.id) || 0;

                  return (
                    <GoalListRow
                      key={g.id}
                      goal={g}
                      northStarMeta={{
                        id: nsMeta.id,
                        title: nsMeta.title,
                        color: nsMeta.color,
                      }}
                      linkedTaskCount={taskCount}
                      onOpen={() => setOpenId(g.id)}
                    />
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Goal Form Modal */}
      <GoalForm
        open={creating}
        onClose={() => setCreating(false)}
        goal={editingGoal}
        initialType={initialType}
        initialNorthStarId={initialNorthStarId}
        defaultTargetYear={selectedYear}
      />

      {/* Goal Detail Modal */}
      <GoalDetail goal={goals.find((g) => g.id === openId)} onClose={() => setOpenId(null)} />

      {/* Delete North Star Confirmation Dialog */}
      <Modal
        open={!!deletingNorthStar}
        onClose={() => setDeletingNorthStar(null)}
        title="Delete North Star"
        size="sm"
      >
        <div className="space-y-4 pt-1">
          <p className="text-[13px] text-muted leading-relaxed">
            Are you sure you want to delete the North Star{" "}
            <strong className="text-text font-semibold">&ldquo;{deletingNorthStar?.title}&rdquo;</strong>?
          </p>

          {deletingNorthStar && deletingNorthStar.goalCount > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] text-amber-600 dark:text-amber-400">
              This North Star currently has <strong className="font-semibold">{deletingNorthStar.goalCount}</strong> active {deletingNorthStar.goalCount === 1 ? "goal" : "goals"}. The goals will remain in your system as standalone goals.
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
            <button
              type="button"
              onClick={() => setDeletingNorthStar(null)}
              className="rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteNorthStar}
              className="rounded-full bg-danger px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-danger/90 transition-colors shadow-xs"
            >
              Delete North Star
            </button>
          </div>
        </div>
      </Modal>
    </Hydrate>
  );
}
