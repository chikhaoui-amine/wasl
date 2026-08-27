"use client";

import { useState } from "react";
import { CalendarRange, Pencil, PartyPopper, Flame, Target, Compass } from "lucide-react";
import {
  useGoalsData,
  goalProgress,
  timelineProgress,
  milestoneProgress,
  daysLeft,
  trackState,
  periodLabel,
  getNorthStarMeta,
  type Goal,
} from "@/lib/data/domains/goals";
import { useTasksData } from "@/lib/data/domains/tasks";
import { Modal } from "@/components/ui/Modal";
import { ProgressRing, Pill, ProgressBar } from "@/components/ui/primitives";
import { GoalForm } from "@/components/forms/GoalForm";
import { CategoryPill } from "@/components/goals/CategoryPill";
import { DetailSection, MilestoneList, LinkedTasks } from "@/components/details/parts";

export function TrackPill({ state }: { state: ReturnType<typeof trackState> }) {
  if (state === "done")
    return (
      <Pill tone="success">
        <PartyPopper className="h-3 w-3" /> done
      </Pill>
    );
  if (state === "on-track") return <Pill tone="success">on track</Pill>;
  if (state === "behind") return <Pill tone="warn">behind</Pill>;
  return null;
}

export function GoalDetail({ goal, onClose }: { goal?: Goal; onClose: () => void }) {
  const {
    updateGoal,
    addMilestone,
    toggleMilestone,
    deleteMilestone,
    updateMilestone,
    moveMilestone,
  } = useGoalsData();
  const { tasks } = useTasksData();
  const [editing, setEditing] = useState(false);

  if (!goal) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;

  const progress = goalProgress(goal);
  const tProg = timelineProgress(goal);
  const mProg = milestoneProgress(goal);
  const left = daysLeft(goal);
  const track = trackState(goal, progress);
  const milestones = goal.milestones ?? [];
  const linkedTasks = tasks.filter((t) => t.goalId === goal.id);
  const northStar = getNorthStarMeta(goal.northStarId || goal.category);

  return (
    <>
      <Modal
        open={!!goal}
        onClose={onClose}
        size="2xl"
        title={goal.type === "north_star" ? "North Star Direction" : "Outcome Details"}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex gap-4">
            {goal.type !== "north_star" && (
              <ProgressRing value={progress} size={76} stroke={6}>
                <span className="tabular text-sm font-semibold text-text">{progress}%</span>
              </ProgressRing>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-xl font-semibold leading-snug tracking-tight text-text">
                  {goal.title}
                </h2>
                <button
                  onClick={() => setEditing(true)}
                  aria-label="Edit item"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-hover hover:text-text"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              {goal.why && <p className="mt-1 text-[13px] leading-relaxed text-muted">{goal.why}</p>}
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px] text-faint">
                <CategoryPill category={northStar.id} />
                {goal.type === "north_star" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-bold text-accent">
                    <Compass className="h-3 w-3" /> Lifetime Goal (No Deadline)
                  </span>
                )}
                {goal.isCurrentFocus && goal.type !== "north_star" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent">
                    <Flame className="h-3 w-3" /> Focus
                  </span>
                )}
                {goal.type !== "north_star" && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1.5">
                      <CalendarRange className="h-3.5 w-3.5" />
                      {periodLabel(goal)}
                    </span>
                    {left !== null && !goal.completed && (
                      <span className="tabular rounded-pill bg-surface-2 px-2 py-0.5">{left}d left</span>
                    )}
                    <TrackPill state={track} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Milestone Progress Bar */}
          {goal.type !== "north_star" && mProg !== null && (
            <div className="rounded-2xl border border-border bg-surface-2 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-text flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-accent" /> Milestones ({milestones.filter((m) => m.done).length}/{milestones.length})
                </span>
                <span className="font-mono font-semibold text-accent">{mProg}%</span>
              </div>
              <ProgressBar value={mProg} color="var(--accent)" />
            </div>
          )}

          {/* Milestones Section */}
          <DetailSection
            title="Milestones"
            count={milestones.length ? `${milestones.filter((m) => m.done).length}/${milestones.length}` : undefined}
          >
            <MilestoneList
              milestones={milestones}
              onAdd={(title) => addMilestone(goal.id, title)}
              onToggle={(id) => toggleMilestone(goal.id, id)}
              onDelete={(id) => deleteMilestone(goal.id, id)}
              onUpdate={(id, title) => updateMilestone(goal.id, id, title)}
              onMove={(id, dir) => moveMilestone(goal.id, id, dir)}
            />
          </DetailSection>

          {/* Linked Tasks Section */}
          <DetailSection
            title="Linked Tasks"
            count={linkedTasks.length ? `${linkedTasks.filter((t) => t.status === "done").length}/${linkedTasks.length}` : undefined}
          >
            <LinkedTasks tasks={linkedTasks} quickAddDefaults={{ goalId: goal.id }} />
          </DetailSection>
        </div>
      </Modal>

      <GoalForm open={editing} onClose={() => setEditing(false)} goal={goal} />
    </>
  );
}
