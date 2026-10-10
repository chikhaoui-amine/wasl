"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Flame, Pencil, Plus, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useTasksData, type Priority, type Task } from "@/lib/data/domains/tasks";
import { useGoalsData } from "@/lib/data/domains/goals";
import {
  useRecurringData,
  isOccurrence,
  ruleLabel,
  completionRate,
  recurringStreak,
  type RecurringTask,
} from "@/lib/data/domains/recurring";
import { Card, ProgressBar } from "@/components/ui/primitives";
import { TaskItem } from "@/components/entities/TaskItem";
import { TaskForm } from "@/components/forms/TaskForm";
import { RecurringTaskForm } from "@/components/forms/RecurringTaskForm";
import { MonthlyFocusSection } from "@/components/tasks/MonthlyFocusSection";
import { buildTaskPlan, parseQuickAdd } from "@/components/tasks/task-plan";
import { Hydrate } from "@/lib/hydration";
import { todayISO, addDays, fromISO, relLabel, weekISO } from "@/lib/date";
import { cn } from "@/lib/utils";

type View = "today" | "week" | "later" | "recurring";

const sectionLabel = "text-[11px] font-medium uppercase tracking-[0.14em] text-faint";

function nextOccurrenceFromToday(task: RecurringTask, today: string): string | null {
  let cursor = today;
  for (let i = 0; i < 90; i++) {
    if (task.endDate && cursor > task.endDate) return null;
    if (isOccurrence(task, cursor) && !task.completions[cursor]) return cursor;
    cursor = addDays(cursor, 1);
  }
  return null;
}

const dayHeading = (iso: string) =>
  fromISO(iso).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

export default function TasksPage() {
  const { tasks, addTask, updateTask } = useTasksData();
  const { goals } = useGoalsData();
  const { recurring, toggleOccurrence } = useRecurringData();

  const [view, setView] = useState<View>("today");
  const [formOpen, setFormOpen] = useState(false);
  const [creatingRecurring, setCreatingRecurring] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTask | undefined>();
  const [showDone, setShowDone] = useState(false);

  const t = todayISO();
  const week = useMemo(() => weekISO(fromISO(t)), [t]);
  const plan = useMemo(() => buildTaskPlan(tasks, t, week), [tasks, t, week]);
  const goalTitle = useMemo(() => new Map(goals.map((g) => [g.id, g.title])), [goals]);

  const recurringToday = recurring.filter((r) => isOccurrence(r, t));
  const recurringOpenToday = recurringToday.filter((r) => !r.completions[t]);

  // Today's progress counts one-off tasks and recurring items due today.
  const todayTotal = plan.today.length + plan.doneToday.length + recurringToday.length;
  const todayDone = plan.doneToday.length + (recurringToday.length - recurringOpenToday.length);
  const weekCount = plan.week.reduce((n, d) => n + d.tasks.length, 0) + plan.weekAnytime.length;
  const laterCount = plan.later.length + plan.someday.length;

  const views: { id: View; label: string; count: number }[] = [
    { id: "today", label: "Today", count: plan.overdue.length + plan.today.length + recurringOpenToday.length },
    { id: "week", label: "This week", count: weekCount },
    { id: "later", label: "Later", count: laterCount },
    { id: "recurring", label: "Recurring", count: recurring.length },
  ];

  const rescheduleOverdue = async () => {
    for (const task of plan.overdue) {
      await updateTask(task.id, { due: t, today: true });
    }
  };

  const row = (task: Task, showDue = false) => (
    <TaskItem
      key={task.id}
      task={task}
      showDue={showDue}
      goalTitle={task.goalId ? goalTitle.get(task.goalId) : undefined}
    />
  );

  return (
    <Hydrate>
      <div className="space-y-5 sm:space-y-6">
        {/* Header: today's progress + full form entry */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <p className="font-display text-2xl font-semibold tracking-tight text-text sm:text-[28px]">
              {todayTotal === 0 ? (
                <span className="text-muted">A clear day</span>
              ) : todayDone === todayTotal ? (
                "All done for today"
              ) : (
                <>
                  <span className="tabular-nums">{todayTotal - todayDone}</span>
                  <span className="text-muted"> left today</span>
                </>
              )}
            </p>
            {todayTotal > 0 && (
              <div className="flex items-center gap-2.5">
                <ProgressBar value={(todayDone / todayTotal) * 100} className="h-1.5 w-40" label="Today's progress" />
                <span className="text-[12px] tabular-nums text-faint">
                  {todayDone} of {todayTotal} done
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => (view === "recurring" ? setCreatingRecurring(true) : setFormOpen(true))}
            className="flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:border-border-strong hover:text-text"
          >
            {view === "recurring" ? <Plus className="h-3.5 w-3.5" /> : <SlidersHorizontal className="h-3.5 w-3.5" />}
            {view === "recurring" ? "New recurring" : "Detailed task"}
          </button>
        </header>

        <MonthlyFocusSection />

        {/* Views */}
        <div role="tablist" aria-label="Task views" className="flex gap-4 overflow-x-auto border-b border-border/70 [scrollbar-width:none] sm:gap-6">
          {views.map((v) => (
            <button
              key={v.id}
              role="tab"
              type="button"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 pb-2.5 pt-1 text-[13px] font-medium transition-colors",
                view === v.id ? "border-text text-text" : "border-transparent text-muted hover:text-text",
              )}
            >
              {v.label}
              {v.count > 0 && <span className="text-[11px] tabular-nums text-faint">{v.count}</span>}
            </button>
          ))}
        </div>

        {view !== "recurring" && <QuickAdd view={view} onAdd={addTask} />}

        {/* ---------- Today ---------- */}
        {view === "today" && (
          <div className="space-y-6">
            {plan.overdue.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h2 className={cn(sectionLabel, "text-danger")}>Overdue · {plan.overdue.length}</h2>
                  <button
                    type="button"
                    onClick={rescheduleOverdue}
                    className="flex items-center gap-1 text-[12px] font-medium text-muted transition-colors hover:text-text"
                  >
                    Move all to today <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                <Card className="bg-[linear-gradient(165deg,color-mix(in_oklab,var(--danger)_8%,transparent),transparent_55%)] p-1.5">
                  {plan.overdue.map((task) => row(task, true))}
                </Card>
              </section>
            )}

            {(plan.today.length > 0 || recurringToday.length > 0) && (
              <section className="space-y-2">
                <h2 className={sectionLabel}>Today</h2>
                <Card className="p-1.5">
                  {plan.today.map((task) => row(task))}
                  {recurringToday.map((r) => (
                    <RecurringRow key={r.id} task={r} today={t} onToggle={() => toggleOccurrence(r.id, t)} />
                  ))}
                </Card>
              </section>
            )}

            {plan.overdue.length === 0 && plan.today.length === 0 && recurringToday.length === 0 && (
              <EmptyView
                title={plan.doneToday.length > 0 ? "Everything for today is done" : "Nothing planned for today"}
                body={
                  plan.doneToday.length > 0
                    ? "Pull something from This week or Later, or call it a day."
                    : "Type a task above and press Enter to plan your day."
                }
              />
            )}

            {plan.doneToday.length > 0 && (
              <section className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowDone((s) => !s)}
                  aria-expanded={showDone}
                  className={cn(sectionLabel, "flex items-center gap-1 hover:text-muted")}
                >
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !showDone && "-rotate-90")} />
                  Done today · {plan.doneToday.length}
                </button>
                {showDone && <Card className="p-1.5">{plan.doneToday.map((task) => row(task))}</Card>}
              </section>
            )}
          </div>
        )}

        {/* ---------- This week ---------- */}
        {view === "week" && (
          <div className="space-y-6">
            {plan.weekAnytime.length > 0 && (
              <section className="space-y-2">
                <h2 className={sectionLabel}>Anytime this week</h2>
                <Card className="p-1.5">{plan.weekAnytime.map((task) => row(task))}</Card>
              </section>
            )}
            {plan.week.map(({ day, tasks: dayTasks }) => (
              <section key={day} className="space-y-2">
                <h2 className="text-[12.5px] font-semibold text-muted">
                  {relLabel(day) === "Tomorrow" ? `Tomorrow · ${dayHeading(day)}` : dayHeading(day)}
                </h2>
                {dayTasks.length > 0 ? (
                  <Card className="p-1.5">{dayTasks.map((task) => row(task))}</Card>
                ) : (
                  <p className="rounded-xl border border-dashed border-border px-3 py-2 text-[12px] text-faint">
                    Nothing planned
                  </p>
                )}
              </section>
            ))}
            {plan.week.length === 0 && plan.weekAnytime.length === 0 && (
              <EmptyView title="The week is wrapping up" body="Tasks for next week live under Later." />
            )}
          </div>
        )}

        {/* ---------- Later ---------- */}
        {view === "later" && (
          <div className="space-y-6">
            {plan.later.length > 0 && (
              <section className="space-y-2">
                <h2 className={sectionLabel}>Scheduled</h2>
                <Card className="p-1.5">{plan.later.map((task) => row(task, true))}</Card>
              </section>
            )}
            {plan.someday.length > 0 && (
              <section className="space-y-2">
                <h2 className={sectionLabel}>Someday · no date</h2>
                <Card className="p-1.5">{plan.someday.map((task) => row(task))}</Card>
              </section>
            )}
            {laterCount === 0 && (
              <EmptyView title="Nothing parked for later" body="Ideas and tasks without a date collect here." />
            )}
          </div>
        )}

        {/* ---------- Recurring ---------- */}
        {view === "recurring" && (
          <section className="space-y-3">
            {recurring.length === 0 ? (
              <EmptyView
                title="No recurring tasks yet"
                body="Add bills, maintenance, or anything else that repeats."
              />
            ) : (
              recurring.map((r) => {
                const streak = recurringStreak(r);
                const rate = completionRate(r);
                const next = nextOccurrenceFromToday(r, t);
                const isDueToday = isOccurrence(r, t);
                const doneNow = !!r.completions[t];
                return (
                  <Card key={r.id} className="group p-3 sm:p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-accent/10">
                        <RefreshCw className="h-4 w-4 text-accent" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13.5px] font-medium text-text">{r.title}</span>
                          {streak > 1 && (
                            <span className="flex items-center gap-0.5 text-[11px] tabular-nums text-warn">
                              <Flame className="h-3 w-3" /> {streak}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-faint">
                          <span>{ruleLabel(r.rule)}</span>
                          <span>·</span>
                          <span className="tabular-nums">{rate}% kept</span>
                          {next && (
                            <>
                              <span>·</span>
                              <span>{isDueToday ? (doneNow ? "Done today" : "Due today") : `Next ${relLabel(next)}`}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="hidden w-20 sm:block">
                        <ProgressBar value={rate} label={`${r.title} completion rate`} />
                      </div>
                      {isDueToday && (
                        <button
                          type="button"
                          onClick={() => toggleOccurrence(r.id, t)}
                          aria-label={doneNow ? "Mark incomplete" : "Mark complete"}
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
                        type="button"
                        onClick={() => setEditingRecurring(r)}
                        aria-label={`Edit ${r.title}`}
                        className="grid h-7 w-7 place-items-center rounded-md text-faint opacity-70 transition-opacity hover:bg-surface-2 hover:text-muted sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </Card>
                );
              })
            )}
          </section>
        )}
      </div>

      <TaskForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        defaults={view === "week" ? { weekly: true } : view === "today" ? { today: true } : {}}
      />
      <RecurringTaskForm open={creatingRecurring} onClose={() => setCreatingRecurring(false)} />
      <RecurringTaskForm open={!!editingRecurring} onClose={() => setEditingRecurring(undefined)} task={editingRecurring} />
    </Hydrate>
  );
}

/* ---------- pieces ---------- */

const quickAddCopy: Record<Exclude<View, "recurring">, { placeholder: string; target: string }> = {
  today: { placeholder: "Add a task for today…", target: "Today" },
  week: { placeholder: "Add a task for this week…", target: "This week" },
  later: { placeholder: "Add something for later…", target: "Someday" },
};

function QuickAdd({
  view,
  onAdd,
}: {
  view: Exclude<View, "recurring">;
  onAdd: (input: { title: string; priority: Priority; today: boolean; weekly?: boolean }) => Promise<unknown>;
}) {
  const [value, setValue] = useState("");
  const [high, setHigh] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const copy = quickAddCopy[view];

  const submit = async () => {
    const parsed = parseQuickAdd(value);
    if (!parsed.title || busy) return;
    setBusy(true);
    try {
      await onAdd({
        title: parsed.title,
        priority: high && parsed.priority === "med" ? "high" : parsed.priority,
        today: view === "today",
        weekly: view === "week" || undefined,
      });
      setValue("");
      setHigh(false);
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="card flex items-center gap-2 p-1.5 pl-3 focus-within:border-border-strong"
    >
      <Plus className="h-4 w-4 shrink-0 text-faint" aria-hidden />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={copy.placeholder}
        aria-label={copy.placeholder}
        enterKeyHint="done"
        className="min-w-0 flex-1 bg-transparent py-1.5 text-[14px] text-text outline-none placeholder:text-faint"
      />
      <button
        type="button"
        onClick={() => setHigh((h) => !h)}
        aria-pressed={high}
        title="High priority (or type ! in the title)"
        className={cn(
          "hidden shrink-0 rounded-lg px-2 py-1 text-[12px] font-semibold transition-colors sm:block",
          high ? "bg-danger/15 text-danger" : "text-faint hover:bg-surface-2 hover:text-muted",
        )}
      >
        !
      </button>
      <span className="hidden shrink-0 text-[11px] text-faint md:inline">→ {copy.target}</span>
      <button
        type="submit"
        disabled={!value.trim() || busy}
        className="btn-hero shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-opacity disabled:opacity-40"
      >
        Add
      </button>
    </form>
  );
}

function RecurringRow({ task, today, onToggle }: { task: RecurringTask; today: string; onToggle: () => void }) {
  const done = !!task.completions[today];
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 transition-colors hover:bg-surface-2 sm:gap-3 sm:py-2">
      <button
        type="button"
        onClick={onToggle}
        aria-label={done ? "Mark incomplete" : "Mark complete"}
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-all",
          done ? "border-success bg-success text-bg" : "border-border-strong text-transparent hover:border-accent",
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </button>
      <span className={cn("min-w-0 flex-1 truncate text-[13px] sm:text-sm", done ? "text-faint line-through" : "text-text")}>
        {task.title}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-[11px] text-faint">
        <RefreshCw className="h-3 w-3" /> {ruleLabel(task.rule)}
      </span>
    </div>
  );
}

function EmptyView({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong px-6 py-10 text-center">
      <h3 className="font-display text-[15px] font-semibold text-text">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">{body}</p>
    </div>
  );
}
