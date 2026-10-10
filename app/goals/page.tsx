"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, LayoutGrid, List, Plus, Target } from "lucide-react";
import {
  useGoalsData,
  NORTH_STAR_PRESETS,
  getNorthStarMeta,
  goalProgress,
  goalYear,
  trackState,
  type Goal,
  type GoalType,
  type NorthStarPreset,
} from "@/lib/data/domains/goals";
import { useTasksData } from "@/lib/data/domains/tasks";
import { GoalYearPulse } from "@/components/goals/GoalYearPulse";
import { DirectionNav, type DirectionItem } from "@/components/goals/DirectionNav";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalListRow } from "@/components/goals/GoalListRow";
import { yearElapsedPct } from "@/components/goals/pace";
import { GoalForm } from "@/components/forms/GoalForm";
import { GoalDetail } from "@/components/details/GoalDetail";
import { Hydrate } from "@/lib/hydration";
import { cn } from "@/lib/utils";

type Tab = "active" | "hold" | "done";

interface DirectionMeta {
  id: string;
  title: string;
  color?: string;
  description?: string;
  isUserCreated: boolean;
}

const isYearlyGoal = (g: Goal) => !g.type || g.type === "yearly_outcome";
const isDoneGoal = (g: Goal) => g.completed || g.status === "completed";
const isOnHold = (g: Goal) => !isDoneGoal(g) && (g.status === "paused" || g.status === "later");

const matchesDirection = (g: Goal, dirId: string) => {
  const target = dirId.toLowerCase();
  if (g.northStarId?.toLowerCase() === target) return true;
  if (g.category?.toLowerCase() === target) return true;
  const meta = getNorthStarMeta(g.northStarId || g.category);
  return meta.id.toLowerCase() === target || meta.title.toLowerCase() === target;
};

const inYear = (g: Goal, year: number) => {
  const fallback = g.targetYear || goalYear(g);
  const startY = g.start ? new Date(g.start).getFullYear() : fallback;
  const endY = g.end ? new Date(g.end).getFullYear() : fallback;
  if (!startY && !endY) return true;
  if (startY && endY) return year >= startY && year <= endY;
  return (startY || endY) === year;
};

const avgProgress = (list: Goal[]) =>
  list.length ? Math.round(list.reduce((sum, g) => sum + goalProgress(g), 0) / list.length) : 0;

const sectionLabel = "text-[11px] font-medium uppercase tracking-[0.14em] text-faint";

export default function GoalsPage() {
  const { goals, addGoal, updateGoal, toggleMilestone, toggleGoalDone } = useGoalsData();
  const { tasks } = useTasksData();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedDirectionId, setSelectedDirectionId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("active");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [creating, setCreating] = useState(false);
  const [initialType, setInitialType] = useState<GoalType>("yearly_outcome");
  const [initialNorthStarId, setInitialNorthStarId] = useState<string | undefined>(undefined);
  const [openId, setOpenId] = useState<string | null>(null);

  const userNorthStars = useMemo(() => goals.filter((g) => g.type === "north_star"), [goals]);

  // User-created directions first, then presets they haven't recreated themselves.
  const allDirections: DirectionMeta[] = useMemo(
    () => [
      ...userNorthStars.map((g) => ({
        id: g.id,
        title: g.title,
        description: g.why,
        color: g.customCategoryColor || "#b57edc",
        isUserCreated: true,
      })),
      ...NORTH_STAR_PRESETS.filter(
        (p) => !userNorthStars.some((u) => u.id === p.id || u.title.toLowerCase() === p.title.toLowerCase()),
      ).map((p) => ({ id: p.id, title: p.title, description: p.description, color: p.color, isUserCreated: false })),
    ],
    [userNorthStars],
  );

  const yearly = useMemo(() => goals.filter(isYearlyGoal), [goals]);
  const activeGoals = useMemo(
    () => yearly.filter((g) => !isDoneGoal(g) && !isOnHold(g) && inYear(g, selectedYear)),
    [yearly, selectedYear],
  );
  const doneGoals = useMemo(
    () => yearly.filter((g) => isDoneGoal(g) && inYear(g, selectedYear)),
    [yearly, selectedYear],
  );
  // Paused / "later" goals are parked, not tied to a year — always show them.
  const holdGoals = useMemo(() => yearly.filter(isOnHold), [yearly]);

  const tabGoals = tab === "active" ? activeGoals : tab === "hold" ? holdGoals : doneGoals;

  const directionFor = (g: Goal): DirectionMeta => {
    const found = allDirections.find((d) => matchesDirection(g, d.id));
    if (found) return found;
    const meta = getNorthStarMeta(g.northStarId || g.category, goals);
    return { id: meta.id, title: meta.title, color: meta.color, isUserCreated: false };
  };

  const directionItems: DirectionItem[] = useMemo(
    () =>
      allDirections
        .map((d) => ({
          ...d,
          count: tabGoals.filter((g) => matchesDirection(g, d.id)).length,
          progress: avgProgress(activeGoals.filter((g) => matchesDirection(g, d.id))),
        }))
        .filter((d) => d.isUserCreated || d.count > 0 || d.id === selectedDirectionId),
    [allDirections, tabGoals, activeGoals, selectedDirectionId],
  );

  const suggestions: NorthStarPreset[] = useMemo(
    () =>
      userNorthStars.length >= 5
        ? []
        : NORTH_STAR_PRESETS.filter((p) => !directionItems.some((d) => d.id === p.id)).slice(0, 5),
    [directionItems, userNorthStars],
  );

  const visibleGoals = selectedDirectionId
    ? tabGoals.filter((g) => matchesDirection(g, selectedDirectionId))
    : tabGoals;
  const focusGoals = tab === "active" ? visibleGoals.filter((g) => g.isCurrentFocus) : [];
  const restGoals = tab === "active" ? visibleGoals.filter((g) => !g.isCurrentFocus) : visibleGoals;

  // Non-focus goals grouped by direction, in rail order (used when no direction filter is set).
  const groups = (() => {
    const map = new Map<string, { meta: DirectionMeta; goals: Goal[] }>();
    for (const g of restGoals) {
      const meta = directionFor(g);
      const entry = map.get(meta.id) ?? { meta, goals: [] };
      entry.goals.push(g);
      map.set(meta.id, entry);
    }
    const rank = (id: string) => {
      const i = allDirections.findIndex((d) => d.id === id);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...map.values()].sort((a, b) => rank(a.meta.id) - rank(b.meta.id));
  })();

  const pulse = useMemo(() => {
    let onTrack = 0;
    let behind = 0;
    let totalM = 0;
    let doneM = 0;
    for (const g of activeGoals) {
      const state = trackState(g, goalProgress(g));
      if (state === "on-track") onTrack++;
      if (state === "behind") behind++;
    }
    for (const g of [...activeGoals, ...doneGoals]) {
      totalM += g.milestones?.length ?? 0;
      doneM += g.milestones?.filter((m) => m.done).length ?? 0;
    }
    return { averageProgress: avgProgress([...activeGoals, ...doneGoals]), onTrack, behind, totalM, doneM };
  }, [activeGoals, doneGoals]);

  const taskCountByGoalId = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (t.goalId) map.set(t.goalId, (map.get(t.goalId) || 0) + 1);
    }
    return map;
  }, [tasks]);

  const openCreate = (type: GoalType = "yearly_outcome", northStarId?: string) => {
    setInitialType(type);
    setInitialNorthStarId(type === "north_star" ? undefined : northStarId || selectedDirectionId || undefined);
    setCreating(true);
  };

  const addPresetDirection = (preset: NorthStarPreset) =>
    addGoal({
      title: preset.title,
      why: preset.description,
      type: "north_star",
      category: "north_star",
      customCategoryColor: preset.color,
      status: "active",
    });

  const toggleFocus = (g: Goal) => updateGoal(g.id, { isCurrentFocus: !g.isCurrentFocus });
  const toggleDone = (g: Goal) => toggleGoalDone(g.id);
  const open = (g: Goal) => setOpenId(g.id);

  const renderGoals = (list: Goal[], showDirection: boolean) =>
    tab === "active" && viewMode === "grid" ? (
      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
        {list.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            northStarMeta={directionFor(g)}
            showDirection={showDirection}
            linkedTaskCount={taskCountByGoalId.get(g.id) || 0}
            onOpen={open}
            onToggleMilestone={toggleMilestone}
            onToggleFocus={toggleFocus}
            onToggleDone={toggleDone}
          />
        ))}
      </div>
    ) : (
      <div className="card divide-y divide-border/60 p-1.5">
        {list.map((g) => (
          <GoalListRow
            key={g.id}
            goal={g}
            northStarMeta={directionFor(g)}
            showDirection={showDirection}
            linkedTaskCount={taskCountByGoalId.get(g.id) || 0}
            onOpen={open}
            onToggleDone={toggleDone}
          />
        ))}
      </div>
    );

  const selectedDirection = selectedDirectionId ? allDirections.find((d) => d.id === selectedDirectionId) : null;
  const isBlankSlate = yearly.length === 0 && userNorthStars.length === 0;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "active", label: "Active", count: activeGoals.length },
    { id: "hold", label: "On hold", count: holdGoals.length },
    { id: "done", label: "Done", count: doneGoals.length },
  ];

  return (
    <Hydrate>
      <div className="space-y-5 pb-12 sm:space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {/* The app shell already titles the page "Goals"; the year is the headline here. */}
              <div className="-ml-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedYear((y) => y - 1)}
                  aria-label="Previous year"
                  className="grid h-8 w-8 place-items-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-text active:scale-95"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h1 className="font-display text-3xl font-semibold tabular-nums tracking-tight text-text sm:text-[34px]">
                  <span className="sr-only">Goals for </span>
                  {selectedYear}
                </h1>
                <button
                  type="button"
                  onClick={() => setSelectedYear((y) => y + 1)}
                  aria-label="Next year"
                  className="grid h-8 w-8 place-items-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-text active:scale-95"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              {selectedYear !== currentYear && (
                <button
                  type="button"
                  onClick={() => setSelectedYear(currentYear)}
                  className="text-xs font-medium text-muted underline-offset-4 hover:text-text hover:underline"
                >
                  Back to {currentYear}
                </button>
              )}
            </div>
            <p className="text-[13px] text-muted">Lifetime directions, broken into outcomes you can finish this year.</p>
          </div>

          <button
            type="button"
            onClick={() => openCreate("yearly_outcome")}
            className="btn-hero flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" /> New goal
          </button>
        </header>

        {isBlankSlate ? (
          <section className="card relative overflow-hidden px-5 py-10 text-center sm:px-10 sm:py-14">
            <div className="mx-auto max-w-md space-y-5">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-text">
                <Target className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-xl font-semibold tracking-tight text-text [text-wrap:balance]">
                  Start with where you want your life to go
                </h2>
                <p className="text-[13px] leading-relaxed text-muted">
                  Pick a few lifetime directions, then add one or two outcomes under each that you can finish in{" "}
                  {selectedYear}.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {NORTH_STAR_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addPresetDirection(p)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2/60 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-border-strong hover:text-text active:scale-95"
                  >
                    <Plus className="h-3 w-3" style={{ color: p.color }} />
                    {p.title}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => openCreate("yearly_outcome")}
                className="text-[13px] font-medium text-text underline decoration-border-strong underline-offset-4 hover:decoration-text"
              >
                Or write your first goal
              </button>
            </div>
          </section>
        ) : (
          <>
            <GoalYearPulse
              year={selectedYear}
              yearElapsed={yearElapsedPct(selectedYear)}
              activeGoalsCount={activeGoals.length}
              averageProgress={pulse.averageProgress}
              onTrackCount={pulse.onTrack}
              behindCount={pulse.behind}
              completedCount={doneGoals.length}
              completedMilestones={pulse.doneM}
              totalMilestones={pulse.totalM}
            />

            <div className="grid gap-5 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-8">
              <DirectionNav
                className="lg:sticky lg:top-4 lg:self-start"
                directions={directionItems}
                selectedId={selectedDirectionId}
                totalCount={tabGoals.length}
                suggestions={suggestions}
                onSelect={setSelectedDirectionId}
                onAddDirection={() => openCreate("north_star")}
                onEditDirection={(id) => setOpenId(id)}
                onAddSuggestion={addPresetDirection}
              />

              <div className="min-w-0 space-y-6">
                {/* Status tabs + view toggle */}
                <div className="flex items-center justify-between gap-3 border-b border-border/70">
                  <div role="tablist" aria-label="Goal status" className="flex gap-4 sm:gap-6">
                    {tabs.map((t) => (
                      <button
                        key={t.id}
                        role="tab"
                        type="button"
                        aria-selected={tab === t.id}
                        onClick={() => setTab(t.id)}
                        className={cn(
                          "relative -mb-px flex items-center gap-1.5 border-b-2 pb-2.5 pt-1 text-[13px] font-medium transition-colors",
                          tab === t.id ? "border-text text-text" : "border-transparent text-muted hover:text-text",
                        )}
                      >
                        {t.label}
                        <span className="text-[11px] tabular-nums text-faint">{t.count}</span>
                      </button>
                    ))}
                  </div>

                  {tab === "active" && (
                    <div className="mb-1.5 flex items-center rounded-lg border border-border bg-surface-2/60 p-0.5">
                      {(["grid", "list"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setViewMode(mode)}
                          aria-label={mode === "grid" ? "Card view" : "List view"}
                          aria-pressed={viewMode === mode}
                          className={cn(
                            "grid h-7 w-7 place-items-center rounded-md transition-colors",
                            viewMode === mode ? "bg-surface-hover text-text" : "text-faint hover:text-text",
                          )}
                        >
                          {mode === "grid" ? <LayoutGrid className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected direction header */}
                {selectedDirection && (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedDirection.color }} />
                        <h2 className="font-display text-lg font-semibold tracking-tight text-text">
                          {selectedDirection.title}
                        </h2>
                      </div>
                      {selectedDirection.description && (
                        <p className="mt-1 max-w-[60ch] text-[13px] text-muted">{selectedDirection.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openCreate("yearly_outcome", selectedDirection.id)}
                      className="flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-border-strong hover:text-text"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add goal
                    </button>
                  </div>
                )}

                {visibleGoals.length === 0 ? (
                  <EmptyTab
                    tab={tab}
                    year={selectedYear}
                    directionTitle={selectedDirection?.title}
                    onCreate={() => openCreate("yearly_outcome", selectedDirectionId || undefined)}
                  />
                ) : (
                  <>
                    {focusGoals.length > 0 && (
                      <section aria-labelledby="focus-heading" className="space-y-3">
                        <h2 id="focus-heading" className={cn(sectionLabel, "flex items-center gap-1.5")}>
                          <Flame className="h-3.5 w-3.5 text-warn" /> In focus
                        </h2>
                        {renderGoals(focusGoals, !selectedDirectionId)}
                      </section>
                    )}

                    {restGoals.length > 0 &&
                      (selectedDirectionId || tab !== "active" ? (
                        <section className="space-y-3">
                          {focusGoals.length > 0 && <h2 className={sectionLabel}>Everything else</h2>}
                          {renderGoals(restGoals, !selectedDirectionId)}
                        </section>
                      ) : (
                        groups.map((group) => (
                          <section key={group.meta.id} className="space-y-3">
                            <div className="group/head flex items-center justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => setSelectedDirectionId(group.meta.id)}
                                className="flex min-w-0 items-center gap-2 text-left"
                              >
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: group.meta.color || "var(--accent)" }}
                                />
                                <h2 className="truncate text-[13px] font-semibold tracking-tight text-text underline-offset-4 group-hover/head:underline">
                                  {group.meta.title}
                                </h2>
                                <span className="text-[11px] tabular-nums text-faint">
                                  {group.goals.length} · {avgProgress(group.goals)}%
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openCreate("yearly_outcome", group.meta.id)}
                                aria-label={`Add goal to ${group.meta.title}`}
                                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-faint transition-colors hover:bg-surface-2 hover:text-text sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover/head:opacity-100"
                              >
                                <Plus className="h-3 w-3" /> Add
                              </button>
                            </div>
                            {renderGoals(group.goals, false)}
                          </section>
                        ))
                      ))}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <GoalForm
        open={creating}
        onClose={() => setCreating(false)}
        initialType={initialType}
        initialNorthStarId={initialNorthStarId}
        defaultTargetYear={selectedYear}
      />

      <GoalDetail goal={goals.find((g) => g.id === openId)} onClose={() => setOpenId(null)} />
    </Hydrate>
  );
}

function EmptyTab({
  tab,
  year,
  directionTitle,
  onCreate,
}: {
  tab: Tab;
  year: number;
  directionTitle?: string;
  onCreate: () => void;
}) {
  const copy =
    tab === "hold"
      ? { title: "Nothing on hold", body: "Goals you pause or save for later wait here." }
      : tab === "done"
        ? { title: `No finished goals in ${year} yet`, body: "Completed goals collect here as your record of the year." }
        : directionTitle
          ? {
              title: `No active goals under ${directionTitle}`,
              body: `What would progress in this direction look like by the end of ${year}?`,
            }
          : { title: `No active goals for ${year}`, body: "Add an outcome you can actually finish this year." };

  return (
    <div className="rounded-2xl border border-dashed border-border-strong px-6 py-12 text-center">
      <h3 className="font-display text-base font-semibold text-text">{copy.title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">{copy.body}</p>
      {tab === "active" && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-text px-4 py-1.5 text-xs font-semibold text-bg transition-transform active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" /> Add goal
        </button>
      )}
    </div>
  );
}
