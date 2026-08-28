"use client";

import { useState, useEffect } from "react";
import { Plus, ChevronDown, ChevronRight, ChevronLeft, Compass, Archive, Sparkles, RotateCcw } from "lucide-react";
import {
  useGoalsData,
  NORTH_STAR_PRESETS,
  getNorthStarMeta,
  goalProgress,
  daysLeft,
  periodLabel,
  nextMilestone,
  goalYear,
  goalYearSpanLabel,
  type Goal,
  type GoalType,
} from "@/lib/data/domains/goals";
import { SectionTitle, Pill, ProgressBar } from "@/components/ui/primitives";
import { NorthStarCard } from "@/components/goals/NorthStarCard";
import { GoalForm } from "@/components/forms/GoalForm";
import { GoalDetail } from "@/components/details/GoalDetail";
import { Modal } from "@/components/ui/Modal";
import { Hydrate } from "@/lib/hydration";
import { cn } from "@/lib/utils";

function CompactOutcomeRow({
  goal,
  allNorthStars,
  onOpen,
  hideNorthStarBadge = false,
}: {
  goal: Goal;
  allNorthStars?: { id: string; title: string; color?: string }[];
  onOpen: () => void;
  hideNorthStarBadge?: boolean;
}) {
  const left = daysLeft(goal);
  const progress = goalProgress(goal);
  const nextM = nextMilestone(goal);
  const milestones = goal.milestones ?? [];
  const doneCount = milestones.filter((m) => m.done).length;
  const yearSpan = goalYearSpanLabel(goal);

  const nsId = goal.northStarId || goal.category;
  const nsMatch = allNorthStars?.find((n) => n.id === nsId);
  const nsMeta = getNorthStarMeta(nsId);
  const northStarTitle = nsMatch?.title || nsMeta?.title;
  const northStarColor = nsMatch?.color || nsMeta?.color || "#b57edc";

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className="group flex cursor-pointer flex-col gap-2 rounded-xl border border-border/80 bg-surface-2/70 p-3 sm:px-4 sm:py-3 transition-all hover:border-border-strong hover:bg-surface-2 hover:shadow-xs sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {!hideNorthStarBadge && northStarTitle && (
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-accent-soft/30 px-2 py-0.5 text-[10px] font-semibold text-accent border border-accent/20">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: northStarColor }} />
              {northStarTitle}
            </span>
          )}
          {yearSpan && (
            <span className="rounded-pill bg-surface-3 px-2 py-0.5 text-[10px] font-bold text-muted border border-border/60">
              {yearSpan}
            </span>
          )}
          <h4
            className={cn(
              "font-display text-[14px] font-semibold leading-snug tracking-tight text-text group-hover:text-accent transition-colors",
              goal.completed && "text-faint line-through",
            )}
          >
            {goal.title}
          </h4>
          {goal.status && goal.status !== "active" && (
            <span className="rounded-pill bg-surface-3 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
              {goal.status}
            </span>
          )}
        </div>

        {goal.why && (
          <p className="text-[12px] text-muted line-clamp-1 leading-snug">{goal.why}</p>
        )}

        {nextM && !goal.completed && (
          <p className="text-[11px] text-faint line-clamp-1">
            <span className="font-medium text-muted">Next: </span>
            {nextM.title}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto pt-1 sm:pt-0 border-t border-border/40 sm:border-0 shrink-0">
        <div className="w-24 sm:w-28 space-y-1 text-left sm:text-right">
          <div className="flex items-center justify-between text-[10.5px] sm:text-[11px]">
            <span className="text-faint">
              {milestones.length > 0 ? `${doneCount}/${milestones.length}` : "Progress"}
            </span>
            <span className="font-mono font-semibold text-text">{progress}%</span>
          </div>
          <ProgressBar value={progress} color="var(--accent)" />
        </div>

        <div className="flex flex-col items-end gap-1">
          <Pill tone={left !== null && left <= 7 ? "warn" : "neutral"}>
            {left !== null ? `${left}d left` : periodLabel(goal)}
          </Pill>
        </div>
      </div>
    </div>
  );
}

export default function GoalsPage() {
  const { goals, addGoal, deleteGoal } = useGoalsData();

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
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
  const userNorthStars = goals.filter((g) => g.type === "north_star");

  // Combined list of North Stars for display (custom + non-hidden presets)
  const allNorthStars = [
    ...userNorthStars.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.why || "Lifetime direction",
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

  // Filter Active vs Inactive Yearly Goals (excluding North Stars, Monthly Focus & Challenges)
  const isYearlyGoal = (g: Goal) => {
    if (g.type && g.type !== "yearly_outcome") return false;
    return true;
  };

  const activeGoals = goals.filter((g) => isYearlyGoal(g) && g.status !== "completed" && g.status !== "paused" && g.status !== "later" && !g.completed);
  const inactiveGoals = goals.filter((g) => isYearlyGoal(g) && (g.status === "completed" || g.status === "paused" || g.status === "later" || g.completed));

  // Filter active goals by selected year (supports multi-year spans e.g. 2026-2027)
  const yearActiveGoals = activeGoals.filter((g) => {
    const startY = g.start ? new Date(g.start).getFullYear() : (g.targetYear || goalYear(g));
    const endY = g.end ? new Date(g.end).getFullYear() : (g.targetYear || goalYear(g));
    if (!startY && !endY) return true;
    if (startY && endY) {
      return selectedYear >= startY && selectedYear <= endY;
    }
    const y = startY || endY;
    return y === selectedYear;
  });

  const matchesNorthStar = (g: Goal, ns: { id: string; title: string }) => {
    if (g.northStarId && (g.northStarId === ns.id || g.northStarId.toLowerCase() === ns.title.toLowerCase())) return true;
    if (g.category && (g.category === ns.id || g.category.toLowerCase() === ns.title.toLowerCase())) return true;
    const meta = getNorthStarMeta(g.northStarId || g.category);
    if (meta.id === ns.id || meta.title.toLowerCase() === ns.title.toLowerCase()) return true;
    return false;
  };

  // Only show custom North Stars, presets with active goals, or all presets if no custom ones exist
  const visibleNorthStars = allNorthStars.filter((ns) => {
    if (ns.isUserCreated) return true;
    const count = yearActiveGoals.filter((g) => matchesNorthStar(g, ns)).length;
    if (count > 0) return true;
    if (userNorthStars.length === 0) return true;
    return false;
  });

  const openCreateModal = (type: GoalType = "yearly_outcome", northStarId?: string) => {
    setEditingGoal(undefined);
    setInitialType(type);
    setInitialNorthStarId(northStarId);
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
      <div className="space-y-8 pb-12">
        {/* Header Bar with Year Switcher & Global Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4 sm:pb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text">Life Directions & Goals</h1>
            <p className="text-[12px] sm:text-[14px] text-muted">
              Lifetime North Stars and yearly goals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Year Switcher */}
            <div className="flex items-center gap-1 rounded-full border border-border/80 bg-surface-2/90 px-2.5 py-1 text-xs shadow-sm">
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

            <button
              onClick={() => openCreateModal("north_star")}
              className="flex items-center gap-1 sm:gap-1.5 rounded-full border border-border px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-[11px] sm:text-[12px] font-semibold text-muted hover:text-text hover:border-border-strong transition-all"
            >
              <Plus className="h-3.5 w-3.5" /> Add North Star
            </button>

            <button
              onClick={() => openCreateModal("yearly_outcome")}
              className="btn-hero flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-[12px] sm:text-[13px] font-semibold"
            >
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> New Goal
            </button>
          </div>
        </div>

        {/* NORTH STAR CARDS GRID (CONTAINING NESTED YEARLY GOALS) */}
        <section className="space-y-4">
          <SectionTitle
            action={
              <div className="flex items-center gap-3">
                <button
                  onClick={() => openCreateModal("north_star")}
                  className="text-[12px] font-semibold text-accent hover:underline flex items-center gap-1"
                >
                  + Add North Star
                </button>
                <span className="text-[12px] text-faint">Lifetime Directions & Goals</span>
              </div>
            }
          >
            <Compass className="h-4 w-4 text-accent shrink-0" />
            <span>North Stars & Goals</span>
          </SectionTitle>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 items-start">
            {visibleNorthStars.map((ns) => {
              const nsGoals = yearActiveGoals.filter((g) => matchesNorthStar(g, ns));
              const isUserNS = ns.isUserCreated || userNorthStars.some((g) => g.id === ns.id);

              return (
                <NorthStarCard
                  key={ns.id}
                  preset={ns}
                  activeCount={nsGoals.length}
                  onAddGoal={() => openCreateModal("yearly_outcome", ns.id)}
                  onEdit={isUserNS ? () => editNorthStar(ns) : undefined}
                  onDelete={() =>
                    setDeletingNorthStar({
                      id: ns.id,
                      title: ns.title,
                      isUserCreated: isUserNS,
                      goalCount: nsGoals.length,
                    })
                  }
                >
                  {nsGoals.length > 0 ? (
                    <div className="space-y-2">
                      {nsGoals.map((g) => (
                        <CompactOutcomeRow
                          key={g.id}
                          goal={g}
                          allNorthStars={allNorthStars}
                          onOpen={() => setOpenId(g.id)}
                          hideNorthStarBadge={true}
                        />
                      ))}
                    </div>
                  ) : (
                    <div
                      onClick={() => openCreateModal("yearly_outcome", ns.id)}
                      className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-faint hover:text-muted hover:border-accent/40 cursor-pointer transition-colors"
                    >
                      No active {selectedYear} goals under this direction yet. <span className="text-accent font-semibold">+ Add Goal</span>
                    </div>
                  )}
                </NorthStarCard>
              );
            })}
          </div>

          {/* Quick-create prompt or restore presets if any are hidden */}
          <div className="rounded-xl border border-dashed border-accent/40 bg-accent-soft/10 p-3.5 text-center text-xs text-muted flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent shrink-0" />
              <span>
                {userNorthStars.length === 0
                  ? <span>Tip: Click <strong>&ldquo;+ Add North Star&rdquo;</strong> to define custom lifetime directions, or pick a preset:</span>
                  : <span>Define custom life directions with <strong>&ldquo;+ Add North Star&rdquo;</strong> or pick a preset:</span>}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 justify-center">
              {NORTH_STAR_PRESETS.filter((p) => !userNorthStars.some((u) => u.title.toLowerCase() === p.title.toLowerCase())).slice(0, 4).map((p) => (
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
                  Restore default presets ({hiddenNorthStars.length})
                </button>
              )}
            </div>
          </div>
        </section>

        {/* COMPLETED & ARCHIVED */}
        {inactiveGoals.length > 0 && (
          <section className="space-y-3 pt-4 border-t border-border/60">
            <button
              onClick={() => setShowInactive(!showInactive)}
              className="flex items-center gap-2 text-[13px] font-bold text-muted hover:text-text transition-colors"
            >
              {showInactive ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Archive className="h-4 w-4 text-faint" /> Completed & Archived ({inactiveGoals.length})
            </button>

            {showInactive && (
              <div className="space-y-2 pt-2">
                {inactiveGoals.map((g) => (
                  <CompactOutcomeRow key={g.id} goal={g} allNorthStars={allNorthStars} onOpen={() => setOpenId(g.id)} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <GoalForm
        open={creating}
        onClose={() => setCreating(false)}
        goal={editingGoal}
        initialType={initialType}
        initialNorthStarId={initialNorthStarId}
        defaultTargetYear={selectedYear}
      />
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
