"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Pencil, Plus } from "lucide-react";
import { TaskForm } from "@/components/forms/TaskForm";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { relLabel, todayISO } from "@/lib/date";
import { useGoalsData, type Goal } from "@/lib/data/domains/goals";
import { useTasksData, type Task } from "@/lib/data/domains/tasks";
import { cn } from "@/lib/utils";

const taskFormDefaults = { today: true };

interface TodayTasksCardProps {
  ready: boolean;
  tasks: Task[];
  goals: Goal[];
  onToggleTask: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onAddTask: () => void;
}

export function TodayFocusCard({
  ready,
  tasks,
  goals,
  onToggleTask,
  onEditTask,
  onAddTask,
}: TodayTasksCardProps) {
  const goalById = useMemo(() => new Map(goals.map((goal) => [goal.id, goal])), [goals]);

  if (!ready) {
    return (
      <Card className="p-4 sm:p-5 flex flex-col h-full">
        <SectionTitle>Today’s Tasks</SectionTitle>
        <p className="py-7 text-center text-[13px] text-faint" aria-live="polite">
          Preparing today’s tasks…
        </p>
      </Card>
    );
  }

  const completedCount = tasks.filter((t) => t.status === "done").length;
  const totalCount = tasks.length;
  const t = todayISO();

  return (
    <Card className="overflow-hidden p-4 sm:p-5 flex flex-col h-full">
      <SectionTitle
        action={
          <div className="flex items-center gap-3">
            {totalCount > 0 && (
              <span className="tabular text-[11px] text-faint">
                {completedCount}/{totalCount} done
              </span>
            )}
            <Link
              href="/tasks"
              className="flex items-center gap-1 text-[11px] font-medium text-accent hover:opacity-80"
            >
              All tasks <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        }
      >
        Today’s Tasks
      </SectionTitle>

      {tasks.length === 0 ? (
        <div className="flex min-h-24 sm:min-h-28 flex-col items-center justify-center text-center">
          <p className="text-[12px] sm:text-[13px] font-medium text-muted">
            No tasks scheduled for today.
          </p>
          <button
            type="button"
            onClick={onAddTask}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 sm:py-2 text-[12px] font-medium text-accent transition-colors hover:bg-accent-soft"
          >
            <Plus className="h-3.5 w-3.5" /> Add task
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const goal = task.goalId ? goalById.get(task.goalId) : undefined;
            const done = task.status === "done";

            return (
              <div
                key={task.id}
                className={cn(
                  "group flex items-center justify-between gap-3 rounded-[12px] sm:rounded-[14px] border p-2.5 sm:p-3 transition-all",
                  done
                    ? "border-success/20 bg-success/5"
                    : "border-border/70 bg-surface-2/45 hover:border-border hover:bg-surface-2/75",
                )}
              >
                {/* Left: Checkbox + Priority dot + Title + Goal */}
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleTask(task.id);
                    }}
                    aria-label={done ? "Mark incomplete" : "Mark complete"}
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-all",
                      done
                        ? "border-success bg-success text-bg shadow-xs"
                        : "border-border-strong text-transparent hover:border-accent",
                    )}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </button>

                  {!done && task.priority === "high" && (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger"
                      style={{ boxShadow: "0 0 6px var(--danger)" }}
                      title="High priority"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => onEditTask(task)}
                      className={cn(
                        "block w-full truncate text-left text-[13px] sm:text-sm font-medium transition-colors",
                        done ? "text-faint line-through" : "text-text hover:text-accent",
                      )}
                    >
                      {task.title}
                    </button>
                    {goal && !done && (
                      <p className="truncate text-[10px] text-faint">
                        Goal · {goal.title}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Due label & Pencil */}
                <div className="flex items-center gap-2 shrink-0">
                  {task.due && !done && (
                    <span
                      className={cn(
                        "text-[11px] font-medium",
                        task.due < t ? "text-danger" : "text-faint",
                      )}
                    >
                      {relLabel(task.due)}
                    </span>
                  )}

                  <button
                    onClick={() => onEditTask(task)}
                    aria-label={`Edit ${task.title}`}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-faint opacity-70 transition-opacity hover:bg-surface-3 hover:text-muted sm:opacity-0 group-hover:opacity-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tasks.length > 0 && (
        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5">
          <button
            type="button"
            onClick={onAddTask}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:opacity-80"
          >
            <Plus className="h-3 w-3" /> Add task
          </button>
        </div>
      )}
    </Card>
  );
}

export function TodayFocus({ date = todayISO() }: { date?: string }) {
  const { tasks: allTasks, toggleTask, isLoading: tasksLoading } = useTasksData();
  const { goals, isLoading: goalsLoading } = useGoalsData();
  const [addingTask, setAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const ready = !tasksLoading && !goalsLoading;

  // Filter tasks belonging to today
  const todayTasks = useMemo(() => {
    const overdue: Task[] = [];
    const todayActive: Task[] = [];
    const todayDone: Task[] = [];

    for (const t of allTasks) {
      if (t.status === "done") {
        if (t.completedAt === date || (!t.completedAt && (t.today || t.due === date))) {
          todayDone.push(t);
        }
      } else {
        if (t.due && t.due < date) {
          overdue.push(t);
        } else if (t.today || t.due === date) {
          todayActive.push(t);
        }
      }
    }

    // Sort active tasks: high priority first
    const priorityWeight: Record<Task["priority"], number> = { high: 3, med: 2, low: 1 };
    overdue.sort((a, b) => (priorityWeight[b.priority] ?? 0) - (priorityWeight[a.priority] ?? 0));
    todayActive.sort((a, b) => (priorityWeight[b.priority] ?? 0) - (priorityWeight[a.priority] ?? 0));
    todayDone.sort((a, b) => ((a.completedAt ?? "") > (b.completedAt ?? "") ? -1 : 1));

    return [...overdue, ...todayActive, ...todayDone];
  }, [allTasks, date]);

  return (
    <>
      <TodayFocusCard
        ready={ready}
        tasks={todayTasks}
        goals={goals}
        onToggleTask={toggleTask}
        onEditTask={(task) => setEditingTask(task)}
        onAddTask={() => setAddingTask(true)}
      />

      <TaskForm
        open={addingTask}
        onClose={() => setAddingTask(false)}
        defaults={taskFormDefaults}
      />

      <TaskForm
        open={!!editingTask}
        onClose={() => setEditingTask(undefined)}
        task={editingTask}
      />
    </>
  );
}
