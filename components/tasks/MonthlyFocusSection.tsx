"use client";

import { useState } from "react";
import { Plus, Target, Pencil, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useGoalsData, getNorthStarMeta, type Goal } from "@/lib/data/domains/goals";
import { useTasksData } from "@/lib/data/domains/tasks";
import { Card } from "@/components/ui/primitives";
import { MonthlyOutcomeModal } from "@/components/forms/MonthlyOutcomeModal";
import { cn } from "@/lib/utils";

export function MonthlyFocusSection() {
  const { goals, toggleGoalDone } = useGoalsData();
  const { tasks } = useTasksData();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingOutcome, setEditingOutcome] = useState<Goal | undefined>();
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const monthIndex = currentDate.getMonth(); // 0-11
  const monthName = currentDate.toLocaleString("default", { month: "long" });
  const currentYear = new Date().getFullYear();
  const targetMonthISO = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, monthIndex - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, monthIndex + 1, 1));
  };

  // Filter monthly focus outcomes for the selected month/year
  const monthlyOutcomes = goals.filter((g) => {
    if (g.type !== "monthly_outcome") return false;
    if (g.targetMonth) return g.targetMonth === targetMonthISO;
    return true;
  });

  const maxReached = monthlyOutcomes.length >= 5;

  return (
    <section className="space-y-2.5">
      {/* Section Header with Month Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/15 text-accent">
            <Target className="h-3.5 w-3.5" />
          </div>

          {/* Month Switcher Pill (< Month >) */}
          <div className="flex items-center gap-1 bg-surface-2 rounded-full px-2 py-1 border border-border/60 shadow-xs">
            <button
              onClick={handlePrevMonth}
              className="p-0.5 text-faint hover:text-text rounded-full hover:bg-surface-3 transition-colors"
              title="Previous month"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs font-bold text-text px-1 select-none">
              {monthName} {year !== currentYear ? year : ""}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-0.5 text-faint hover:text-text rounded-full hover:bg-surface-3 transition-colors"
              title="Next month"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <span className="tabular rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">
            {monthlyOutcomes.length}/5
          </span>
        </div>

        <button
          onClick={() => {
            setEditingOutcome(undefined);
            setModalOpen(true);
          }}
          disabled={maxReached}
          className={cn(
            "flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-semibold transition-all",
            maxReached
              ? "opacity-50 cursor-not-allowed bg-surface-2 text-faint"
              : "bg-surface-2 text-muted hover:bg-surface-3 hover:text-text",
          )}
          title={maxReached ? "Maximum 5 monthly focus outcomes allowed" : "Add monthly focus outcome"}
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Focus</span>
        </button>
      </div>

      {/* Monthly Focus To-Do List */}
      {monthlyOutcomes.length === 0 ? (
        <Card
          onClick={() => {
            setEditingOutcome(undefined);
            setModalOpen(true);
          }}
          className="p-4 text-center cursor-pointer border-dashed border-border hover:border-accent/40 transition-all group"
        >
          <div className="flex flex-col items-center justify-center gap-1 text-faint group-hover:text-muted">
            <p className="text-xs font-medium">
              No monthly focus tasks for {monthName} yet.
            </p>
            <span className="text-[11px] text-accent font-semibold flex items-center gap-0.5">
              Click to set key monthly goals <ChevronRight className="h-3 w-3" />
            </span>
          </div>
        </Card>
      ) : (
        <Card className="p-2">
          <div className="space-y-0.5">
            {monthlyOutcomes.map((outcome) => {
              const done = outcome.completed || outcome.status === "completed";

              // Find linked yearly goal & North Star meta
              const linkedGoal = goals.find((g) => g.id === outcome.linkedOutcomeId);
              const nsMeta = getNorthStarMeta(
                outcome.northStarId || linkedGoal?.northStarId || linkedGoal?.category,
              );

              // Calculate task counts
              const relatedTasks = tasks.filter(
                (t) =>
                  t.goalId === outcome.id ||
                  (outcome.linkedOutcomeId && t.goalId === outcome.linkedOutcomeId),
              );
              const completedTasks = relatedTasks.filter((t) => t.status === "done").length;
              const totalTasks = relatedTasks.length;

              return (
                <div
                  key={outcome.id}
                  className="group flex items-center gap-2.5 sm:gap-3 rounded-[10px] sm:rounded-[12px] px-2 py-1.5 sm:py-2 transition-colors hover:bg-surface-2"
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGoalDone(outcome.id);
                    }}
                    aria-label={done ? "Mark incomplete" : "Mark complete"}
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-all",
                      done
                        ? "border-success bg-success text-bg"
                        : "border-border-strong text-transparent hover:border-accent",
                    )}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </button>

                  {/* North Star / Goal Color Dot */}
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: nsMeta.color,
                      boxShadow: done ? undefined : `0 0 6px ${nsMeta.color}80`,
                    }}
                    title={nsMeta.title}
                  />

                  {/* Title button */}
                  <button
                    onClick={() => {
                      setEditingOutcome(outcome);
                      setModalOpen(true);
                    }}
                    className={cn(
                      "min-w-0 flex-1 truncate text-left text-[13px] sm:text-sm transition-all",
                      done ? "text-faint line-through" : "text-text font-medium",
                    )}
                  >
                    {outcome.title}
                  </button>

                  {/* Linked Yearly Goal */}
                  {linkedGoal && (
                    <span className="hidden shrink-0 text-[11px] text-faint md:inline truncate max-w-[150px]">
                      {linkedGoal.title}
                    </span>
                  )}

                  {/* Task counts pill */}
                  {totalTasks > 0 && (
                    <span className="tabular shrink-0 text-[10px] text-faint rounded bg-surface-3/50 px-1.5 py-0.5">
                      {completedTasks}/{totalTasks} tasks
                    </span>
                  )}

                  {/* Edit Pencil Button */}
                  <button
                    onClick={() => {
                      setEditingOutcome(outcome);
                      setModalOpen(true);
                    }}
                    aria-label={`Edit ${outcome.title}`}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-faint opacity-70 transition-opacity hover:bg-surface-3 hover:text-muted sm:opacity-0 group-hover:opacity-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Create / Edit Modal */}
      <MonthlyOutcomeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        outcomeToEdit={editingOutcome}
        defaultMonth={targetMonthISO}
      />
    </section>
  );
}
