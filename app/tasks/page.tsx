"use client";

import { useState } from "react";
import { CalendarDays, Check, Flame, Pencil, Plus, RefreshCw, Repeat } from "lucide-react";
import { useTasksData, type Task } from "@/lib/data/domains/tasks";
import {
  useRecurringData,
  isOccurrence,
  ruleLabel,
  completionRate,
  recurringStreak,
  type RecurringTask,
} from "@/lib/data/domains/recurring";
import { Card, ProgressBar, SectionTitle } from "@/components/ui/primitives";
import { TaskItem } from "@/components/entities/TaskItem";
import { TaskForm } from "@/components/forms/TaskForm";
import { RecurringTaskForm } from "@/components/forms/RecurringTaskForm";
import { Hydrate } from "@/lib/hydration";
import { todayISO, addDays, relLabel, weekISO } from "@/lib/date";
import { MonthlyFocusSection } from "@/components/tasks/MonthlyFocusSection";
import { cn } from "@/lib/utils";

/* ---------- one-off helpers ---------- */

function bucket(t: Task, today: string): "today" | "overdue" | "weekly" | "upcoming" | "someday" | "done" {
  if (t.status === "done") return "done";
  if (t.due && t.due < today) return "overdue";
  if (t.today || t.due === today) return "today";
  const w = weekISO();
  if (t.weekly || (t.due && t.due >= w[0] && t.due <= w[6])) return "weekly";
  if (t.due && t.due > today) return "upcoming";
  return "someday";
}

function Group({ title, items, tone }: { title: string; items: Task[]; tone?: "danger" }) {
  if (items.length === 0) return null;
  return (
    <section>
      <SectionTitle>
        <span className={tone === "danger" ? "text-danger" : undefined}>
          {title}
        </span>
      </SectionTitle>
      <Card
        className={
          tone === "danger"
            ? "bg-[linear-gradient(165deg,color-mix(in_oklab,var(--danger)_9%,transparent),transparent_50%)] p-2"
            : "p-2"
        }
      >
        <div className="space-y-0.5">
          {items.map((t) => (
            <TaskItem key={t.id} task={t} showDue />
          ))}
        </div>
      </Card>
    </section>
  );
}

/* ---------- recurring helpers ---------- */

function nextOccurrenceFromToday(task: RecurringTask): string | null {
  const t = todayISO();
  let cursor = t;
  for (let i = 0; i < 90; i++) {
    if (task.endDate && cursor > task.endDate) return null;
    if (isOccurrence(task, cursor) && !task.completions[cursor]) return cursor;
    cursor = addDays(cursor, 1);
  }
  return null;
}

/* ---------- main page ---------- */

type TabKey = "tasks" | "weekly" | "recurring";

export default function TasksPage() {
  const { tasks } = useTasksData();
  const { recurring, toggleOccurrence } = useRecurringData();

  const [tab, setTab] = useState<TabKey>("tasks");
  const [creating, setCreating] = useState(false);
  const [creatingWeekly, setCreatingWeekly] = useState(false);
  const [creatingRecurring, setCreatingRecurring] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTask | undefined>();

  const t = todayISO();
  const week = weekISO();

  /* weekly tasks list */
  const weeklyTasks = tasks.filter(
    (task) => task.weekly || (task.due && task.due >= week[0] && task.due <= week[6]),
  );
  const doneWeekly = weeklyTasks.filter((t) => t.status === "done").length;
  const activeWeekly = weeklyTasks.filter((t) => t.status === "todo");

  /* one-off buckets */
  const groups = {
    overdue: [] as Task[],
    today: [] as Task[],
    weekly: [] as Task[],
    upcoming: [] as Task[],
    someday: [] as Task[],
    done: [] as Task[],
  };
  for (const task of tasks) groups[bucket(task, t)].push(task);
  groups.upcoming.sort((a, b) => (a.due! < b.due! ? -1 : 1));
  groups.done.sort((a, b) => ((a.completedAt ?? "") > (b.completedAt ?? "") ? -1 : 1));

  /* daily tasks: overdue + today + done today */
  const doneTodayTasks = tasks.filter(
    (task) =>
      task.status === "done" &&
      (task.completedAt === t || (!task.completedAt && (task.today || task.due === t))),
  );
  doneTodayTasks.sort((a, b) => ((a.completedAt ?? "") > (b.completedAt ?? "") ? -1 : 1));
  const activeDailyCount = groups.overdue.length + groups.today.length;

  /* recurring: due today */
  const dueToday = recurring.filter((r) => isOccurrence(r, t));
  const doneToday = dueToday.filter((r) => r.completions[t]).length;

  const legend = [
    { c: "var(--danger)", l: "High" },
    { c: "var(--warn)", l: "Medium" },
    { c: "var(--faint)", l: "Low" },
  ];

  return (
    <Hydrate>
      <div className="space-y-6">
        {/* Monthly Focus outcomes section */}
        <MonthlyFocusSection />

        {/* Tab bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex gap-0.5 rounded-[12px] sm:rounded-[14px] bg-surface-2 p-0.5 sm:p-1 overflow-x-auto scrollbar-none">
            {(
              [
                { key: "tasks" as TabKey, label: "Daily Tasks", count: activeDailyCount },
                { key: "weekly" as TabKey, label: "Weekly Tasks", count: activeWeekly.length },
                { key: "recurring" as TabKey, label: "Recurring", count: recurring.length },
              ]
            ).map((tb) => (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={cn(
                  "flex items-center gap-1 sm:gap-1.5 rounded-[8px] sm:rounded-[10px] px-2.5 py-1.5 sm:px-4 sm:py-2 text-[12px] sm:text-[13px] font-semibold transition-all shrink-0",
                  tab === tb.key
                    ? "bg-surface text-text shadow-sm"
                    : "text-faint hover:text-muted",
                )}
              >
                {tb.key === "weekly" && <CalendarDays className="h-3.5 w-3.5 text-accent" />}
                {tb.key === "recurring" && <Repeat className="h-3.5 w-3.5" />}
                {tb.label}
                {tb.count > 0 && (
                  <span className="tabular rounded-pill bg-surface-2 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium text-faint">
                    {tb.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              if (tab === "weekly") setCreatingWeekly(true);
              else if (tab === "tasks") setCreating(true);
              else setCreatingRecurring(true);
            }}
            className="btn-hero flex items-center gap-1 sm:gap-1.5 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 text-[12px] sm:text-[13px] font-semibold shrink-0"
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />{" "}
            {tab === "weekly" ? "New weekly" : tab === "tasks" ? "New task" : "New recurring"}
          </button>
        </div>

        {/* ---- Daily Tasks tab ---- */}
        {tab === "tasks" && (
          <>
            <div className="flex items-center gap-4">
              {legend.map((x) => (
                <span key={x.l} className="flex items-center gap-1.5 text-[11px] text-faint">
                  <span className="h-2 w-2 rounded-full" style={{ background: x.c }} />
                  {x.l}
                </span>
              ))}
            </div>

            {groups.overdue.length === 0 && groups.today.length === 0 && doneTodayTasks.length === 0 ? (
              <Card className="p-10 text-center text-sm text-faint">
                No tasks scheduled for today. Click &quot;New task&quot; to plan your day!
              </Card>
            ) : (
              <div className="space-y-7">
                <Group title="Overdue" items={groups.overdue} tone="danger" />
                <Group title="Today" items={groups.today} />
                <Group title="Done Today" items={doneTodayTasks} />
              </div>
            )}
          </>
        )}

        {/* ---- Weekly Tasks tab ---- */}
        {tab === "weekly" && (
          <div className="space-y-5">
            {/* Active Weekly Tasks */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <SectionTitle>Active Weekly Tasks ({activeWeekly.length})</SectionTitle>
                <button
                  onClick={() => setCreatingWeekly(true)}
                  className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Task
                </button>
              </div>

              {activeWeekly.length === 0 ? (
                <Card className="p-8 text-center text-xs text-faint">
                  No active weekly tasks. Click &ldquo;+ Add Task&rdquo; or schedule tasks for this week!
                </Card>
              ) : (
                <Card className="p-2">
                  <div className="space-y-0.5">
                    {activeWeekly.map((t) => (
                      <TaskItem key={t.id} task={t} showDue />
                    ))}
                  </div>
                </Card>
              )}
            </section>

            {/* Completed Weekly Tasks */}
            {doneWeekly > 0 && (
              <section>
                <SectionTitle>Completed This Week ({doneWeekly})</SectionTitle>
                <Card className="p-2">
                  <div className="space-y-0.5">
                    {weeklyTasks
                      .filter((t) => t.status === "done")
                      .map((t) => (
                        <TaskItem key={t.id} task={t} showDue />
                      ))}
                  </div>
                </Card>
              </section>
            )}
          </div>
        )}

        {/* ---- Recurring tab ---- */}
        {tab === "recurring" && (
          <div className="space-y-5">
            {/* Due today strip */}
            {dueToday.length > 0 && (
              <section>
                <SectionTitle>
                  Due today · {doneToday}/{dueToday.length}
                </SectionTitle>
                <Card className="p-2">
                  <div className="space-y-0.5">
                    {dueToday.map((r) => {
                      const done = !!r.completions[t];
                      return (
                        <div
                          key={r.id}
                          className="group flex items-center gap-2.5 sm:gap-3 rounded-[10px] sm:rounded-[12px] px-2 py-1.5 sm:py-2 transition-colors hover:bg-surface-2"
                        >
                          <button
                            onClick={() => toggleOccurrence(r.id, t)}
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

                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate text-[13px] sm:text-sm",
                              done ? "text-faint line-through" : "text-text",
                            )}
                          >
                            {r.title}
                          </span>

                          <span className="hidden shrink-0 text-[11px] text-faint sm:inline">
                            {ruleLabel(r.rule)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </section>
            )}

            {/* All recurring tasks */}
            <section>
              <SectionTitle>All recurring tasks</SectionTitle>
              {recurring.length === 0 ? (
                <Card className="p-10 text-center text-sm text-faint">
                  No recurring tasks yet — add bills, maintenance, or any obligation that repeats.
                </Card>
              ) : (
                <div className="space-y-3">
                  {recurring.map((r) => {
                    const streak = recurringStreak(r);
                    const rate = completionRate(r);
                    const next = nextOccurrenceFromToday(r);
                    const isDueToday = isOccurrence(r, t);
                    const doneNow = !!r.completions[t];

                    return (
                      <Card key={r.id} className="group p-3 sm:p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="grid h-9 w-9 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-[10px] sm:rounded-[12px] bg-accent/10">
                              <RefreshCw className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-accent" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-[13px] sm:text-sm font-medium text-text">
                                  {r.title}
                                </span>
                                {streak > 1 && (
                                  <span className="tabular flex items-center gap-0.5 text-[10px] sm:text-[11px] text-warn">
                                    <Flame className="h-3 w-3" /> {streak}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-faint">
                                <span>{ruleLabel(r.rule)}</span>
                                <span>·</span>
                                <span className="tabular">{rate}% rate</span>
                                {next && (
                                  <>
                                    <span>·</span>
                                    <span>
                                      {isDueToday ? (doneNow ? "✓ Done" : "Due today") : `Next: ${relLabel(next)}`}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* 30-day completion bar */}
                            <div className="w-20 hidden sm:block">
                              <ProgressBar value={rate} />
                            </div>

                            {isDueToday && (
                              <button
                                onClick={() => toggleOccurrence(r.id, t)}
                                className={cn(
                                  "grid h-7 w-7 place-items-center rounded-md border transition-all",
                                  doneNow
                                    ? "border-success bg-success text-bg"
                                    : "border-border-strong text-transparent hover:border-accent",
                                )}
                              >
                                <Check className="h-3.5 w-3.5" strokeWidth={3} />
                              </button>
                            )}

                            <button
                              onClick={() => setEditingRecurring(r)}
                              aria-label={`Edit ${r.title}`}
                              className="grid h-7 w-7 place-items-center rounded-md text-faint transition-opacity hover:bg-surface-2 hover:text-muted opacity-70 sm:opacity-0 sm:group-hover:opacity-100"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <TaskForm open={creating} onClose={() => setCreating(false)} defaults={{ today: true }} />
      <TaskForm open={creatingWeekly} onClose={() => setCreatingWeekly(false)} defaults={{ weekly: true }} />
      <RecurringTaskForm open={creatingRecurring} onClose={() => setCreatingRecurring(false)} />
      <RecurringTaskForm
        open={!!editingRecurring}
        onClose={() => setEditingRecurring(undefined)}
        task={editingRecurring}
      />
    </Hydrate>
  );
}
