"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Flame, GripVertical, Pencil, Plus, Trophy } from "lucide-react";
import {
  useHabitsData,
  habitStreak,
  weekDone,
  consistencyGrid,
  normalizeHabit,
  type Habit,
} from "@/lib/data/domains/habits";
import { Card, ProgressRing, SectionTitle } from "@/components/ui/primitives";
import { Heatmap } from "@/components/ui/charts";
import { HabitForm } from "@/components/forms/HabitForm";
import { Modal } from "@/components/ui/Modal";
import { Hydrate } from "@/lib/hydration";
import { addDays, fromISO, todayISO, weekISO } from "@/lib/date";
import { DynamicIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

/* ---------- derived helpers (real math, no props theater) ---------- */

const bestStreak = (h: Habit) => {
  const log = h?.log ?? {};
  const dates = Object.keys(log).filter((k) => log[k]).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of dates) {
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
};

const rate30 = (h: Habit) => {
  const t = todayISO();
  const createdAt = h?.createdAt ?? t;
  const from = createdAt > addDays(t, -29) ? createdAt : addDays(t, -29);
  let days = 0;
  let done = 0;
  for (let iso = from; iso <= t; iso = addDays(iso, 1)) {
    days++;
    if (h?.log?.[iso]) done++;
  }
  // rate vs target share of the week
  const targetPerWeek = h?.targetPerWeek ?? 7;
  const expected = (days * targetPerWeek) / 7;
  return expected > 0 ? Math.min(100, Math.round((done / expected) * 100)) : 0;
};

export default function HabitsPage() {
  const { habits: rawHabits, toggleDay, moveHabit, reorderHabits } = useHabitsData();
  const habits = rawHabits.map(normalizeHabit);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Habit | undefined>();
  const [openId, setOpenId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const week = weekISO();
  const t = todayISO();
  const doneToday = habits.filter((h) => h?.log?.[t]).length;

  const weekTotal = habits.reduce((s, h) => s + Math.min(weekDone(h), h?.targetPerWeek ?? 7), 0);
  const weekTarget = habits.reduce((s, h) => s + (h?.targetPerWeek ?? 7), 0);
  const weekPct = weekTarget ? Math.round((weekTotal / weekTarget) * 100) : 0;

  const records = [...habits]
    .map((h) => ({ h, best: bestStreak(h) }))
    .sort((a, b) => b.best - a.best)
    .slice(0, 3);

  const openHabit = habits.find((h) => h.id === openId);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== id) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (targetId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDraggedId(null);
    setDragOverId(null);
    const sourceId = e.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === targetId) return;
    const sourceIdx = habits.findIndex((h) => h.id === sourceId);
    const targetIdx = habits.findIndex((h) => h.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;
    const newHabits = [...habits];
    const [removed] = newHabits.splice(sourceIdx, 1);
    newHabits.splice(targetIdx, 0, removed);
    reorderHabits(newHabits);
  };

  return (
    <Hydrate>
      <div className="space-y-5">
        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px] text-muted">
            <span className="font-display text-xl font-semibold text-text">
              {doneToday}/{habits.length}
            </span>{" "}
            done today
          </p>
          <button
            onClick={() => setCreating(true)}
            className="btn-hero flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold"
          >
            <Plus className="h-4 w-4" /> New habit
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* habit rows (2-column grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:col-span-2 items-start">
            {habits.length === 0 && (
              <Card className="p-10 text-center text-sm text-faint sm:col-span-2">
                No habits yet — start with one small daily win.
              </Card>
            )}
            {habits.map((h, idx) => {
              const streak = habitStreak(h);
              const done = weekDone(h);
              const isFirst = idx === 0;
              const isLast = idx === habits.length - 1;
              const isDragging = draggedId === h.id;
              const isOver = dragOverId === h.id && draggedId !== h.id;

              return (
                <div
                  key={h.id}
                  draggable={habits.length > 1}
                  onDragStart={(e) => handleDragStart(e, h.id)}
                  onDragOver={(e) => handleDragOver(e, h.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(h.id, e)}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setDragOverId(null);
                  }}
                  className={cn(
                    "group transition-all duration-150",
                    isDragging && "opacity-40 scale-[0.98]",
                    isOver && "ring-2 ring-accent rounded-[16px]",
                  )}
                >
                  <Card className="p-3 rounded-[14px] sm:rounded-[16px] transition-all hover:border-border-strong h-full flex flex-col justify-between">
                    {/* Top Block: Habit Info & Actions */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {habits.length > 1 && (
                          <span
                            className="grid h-6 w-4 shrink-0 cursor-grab place-items-center text-faint opacity-40 transition-opacity hover:opacity-100 active:cursor-grabbing"
                            title="Drag to reorder"
                          >
                            <GripVertical className="h-3.5 w-3.5" />
                          </span>
                        )}
                        <button
                          onClick={() => setOpenId(h.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <span
                            className="grid h-8.5 w-8.5 shrink-0 place-items-center rounded-[9px]"
                            style={{ background: `${h.color}22` }}
                          >
                            <DynamicIcon name={h.icon} className="h-4 w-4" style={{ color: h.color }} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-[13px] sm:text-[13.5px] font-semibold text-text group-hover:text-accent transition-colors">
                                {h.name}
                              </span>
                              {streak > 1 && (
                                <span className="tabular flex items-center gap-0.5 rounded-full bg-warn/10 px-1 py-0.2 text-[9.5px] font-semibold text-warn">
                                  <Flame className="h-2.5 w-2.5" /> {streak}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10.5px] text-faint mt-0.5">
                              <span>{h.targetPerWeek === 7 ? "Daily" : `${h.targetPerWeek}×/w`}</span>
                              <span>•</span>
                              <span className="tabular">{done}/{h.targetPerWeek} this week</span>
                            </div>
                          </div>
                        </button>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        {habits.length > 1 && (
                          <>
                            <button
                              onClick={() => moveHabit(h.id, "up")}
                              disabled={isFirst}
                              aria-label={`Move ${h.name} up`}
                              className="grid h-6 w-6 place-items-center rounded-md text-faint transition-opacity hover:bg-surface-2 hover:text-muted disabled:opacity-20 opacity-70 sm:opacity-0 sm:group-hover:opacity-100"
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => moveHabit(h.id, "down")}
                              disabled={isLast}
                              aria-label={`Move ${h.name} down`}
                              className="grid h-6 w-6 place-items-center rounded-md text-faint transition-opacity hover:bg-surface-2 hover:text-muted disabled:opacity-20 opacity-70 sm:opacity-0 sm:group-hover:opacity-100"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setEditing(h)}
                          aria-label={`Edit ${h.name}`}
                          className="grid h-6 w-6 place-items-center rounded-md text-faint transition-opacity hover:bg-surface-2 hover:text-muted opacity-70 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Bottom Block: 7 Days Grid (Full Width) */}
                    <div className="grid grid-cols-7 gap-1 pt-2 border-t border-border/40">
                      {week.map((iso) => {
                        const isToday = iso === t;
                        const isFuture = iso > t;
                        const isPast = iso < t;
                        const isDone = !!h.log[iso];
                        const isMissed = isPast && !isDone;

                        return (
                          <button
                            key={iso}
                            disabled={isFuture}
                            onClick={() => toggleDay(h.id, iso)}
                            title={
                              isFuture
                                ? iso
                                : isDone
                                ? `${iso} — Completed (click to toggle)`
                                : isMissed
                                ? `${iso} — Missed habit (click to log)`
                                : `${iso} — Today (click to complete)`
                            }
                            className={cn(
                              "relative flex h-8.5 sm:h-9 flex-col items-center justify-center gap-0.5 rounded-[6px] sm:rounded-[7px] transition-all overflow-hidden",
                              isDone
                                ? "text-accent-fg shadow-xs font-semibold"
                                : isMissed
                                ? "bg-danger/15 border border-danger/40 text-danger hover:bg-danger/25 hover:border-danger/60"
                                : "bg-surface-2/70 text-faint hover:bg-surface-2 hover:text-muted",
                              isToday && "ring-2 ring-accent ring-offset-1 ring-offset-surface",
                              isFuture ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:scale-[1.04] active:scale-95",
                            )}
                            style={isDone ? { background: h.color } : undefined}
                          >
                            <span
                              className={cn(
                                "text-[8px] font-semibold uppercase leading-none",
                                isDone ? "opacity-85" : isMissed ? "text-danger/80" : "opacity-85",
                              )}
                            >
                              {fromISO(iso).toLocaleDateString("en-US", { weekday: "short" })[0]}
                            </span>
                            <div className="flex items-center justify-center gap-0.5 leading-none">
                              {isMissed ? (
                                <span className="tabular text-[10px] font-bold flex items-center gap-0.5 text-danger">
                                  <span className="text-[9px] font-black leading-none">✕</span>
                                  <span>{fromISO(iso).getDate()}</span>
                                </span>
                              ) : (
                                <span className="tabular text-[10px] font-bold">
                                  {fromISO(iso).getDate()}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>

          {/* side stats */}
          <div className="space-y-4">
            <div className="card-hero flex items-center gap-4 p-4">
              <div className="relative z-10">
                <ProgressRing value={weekPct} size={64}>
                  <span className="tabular text-[13px] font-semibold text-text">{weekPct}%</span>
                </ProgressRing>
              </div>
              <div className="relative z-10">
                <p className="font-medium text-text">This week</p>
                <p className="tabular text-[12px] text-faint">
                  {weekTotal}/{weekTarget} vs targets
                </p>
              </div>
            </div>

            <Card className="p-4">
              <SectionTitle>Consistency · 5 weeks</SectionTitle>
              <Heatmap weeks={consistencyGrid(habits)} />
              <p className="mt-3 text-[11px] text-faint">Darker = more habits kept that day.</p>
            </Card>

            {records.some((r) => r.best > 1) && (
              <Card className="p-4">
                <SectionTitle>Records</SectionTitle>
                <div className="space-y-2">
                  {records.map(({ h, best }) => (
                    <div key={h.id} className="flex items-center justify-between text-[13px]">
                      <span className="flex items-center gap-2 text-muted">
                        <Trophy className="h-3.5 w-3.5 text-warn" />
                        <DynamicIcon name={h.icon} className="h-3.5 w-3.5" style={{ color: h.color }} /> {h.name}
                      </span>
                      <span className="tabular text-faint">{best}d best</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      <HabitForm open={creating} onClose={() => setCreating(false)} />
      <HabitForm open={!!editing} onClose={() => setEditing(undefined)} habit={editing} />
      <HabitDetail habit={openHabit} onClose={() => setOpenId(null)} onEdit={() => openHabit && setEditing(openHabit)} />
    </Hydrate>
  );
}

/* ---------- detail: 12-week clickable history ---------- */

function HabitDetail({
  habit,
  onClose,
  onEdit,
}: {
  habit?: Habit;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { toggleDay } = useHabitsData();
  if (!habit) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;

  const t = todayISO();
  const thisMonday = weekISO()[0];
  const nWeeks = 12;
  const weeks = Array.from({ length: nWeeks }, (_, wi) =>
    Array.from({ length: 7 }, (_, di) => addDays(thisMonday, -(nWeeks - 1 - wi) * 7 + di)),
  );

  const streak = habitStreak(habit);
  const best = bestStreak(habit);
  const total = Object.keys(habit.log).filter((k) => habit.log[k]).length;
  const rate = rate30(habit);

  return (
    <Modal
      open={!!habit}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <DynamicIcon name={habit.icon} className="h-4 w-4" style={{ color: habit.color }} /> {habit.name}
        </span>
      }
      wide
    >
      <div className="space-y-5">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Streak", value: `${streak}d` },
            { label: "Best", value: `${best}d` },
            { label: "30-day rate", value: `${rate}%` },
            { label: "Total", value: total },
          ].map((s) => (
            <div key={s.label} className="rounded-[12px] bg-surface-2 p-3 text-center">
              <div className="tabular font-display text-lg font-semibold text-text">{s.value}</div>
              <div className="text-[10px] text-faint">{s.label}</div>
            </div>
          ))}
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">
            Last 12 weeks — click any past day to fix history
          </p>
          <div className="flex flex-col gap-[3px]">
            {weeks.map((row, i) => (
              <div key={i} className="flex gap-[3px]">
                {row.map((iso) => {
                  const isFuture = iso > t;
                  const isPast = iso < t;
                  const isDone = !!habit.log[iso];
                  const isMissed = isPast && !isDone;

                  return (
                    <button
                      key={iso}
                      disabled={isFuture}
                      onClick={() => toggleDay(habit.id, iso)}
                      title={
                        isFuture
                          ? iso
                          : isDone
                          ? `${iso} — Completed`
                          : isMissed
                          ? `${iso} — Missed (click to fix)`
                          : `${iso} — Today`
                      }
                      className={cn(
                        "h-5 flex-1 rounded-[4px] transition-transform relative flex items-center justify-center text-[9px] font-bold",
                        !isFuture && "hover:scale-y-110",
                        iso === t && "ring-1 ring-ring",
                        isMissed && "border border-danger/40 bg-danger/15 text-danger hover:bg-danger/25",
                      )}
                      style={{
                        background: isDone ? habit.color : isMissed ? undefined : "var(--surface-2)",
                        opacity: isFuture ? 0.25 : 1,
                      }}
                    >
                      {isMissed && <span className="text-[8px] font-black leading-none">✕</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-faint">
            <span>{fromISO(weeks[0][0]).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            <span>today</span>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => {
              onClose();
              onEdit();
            }}
            className="flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit habit
          </button>
        </div>
      </div>
    </Modal>
  );
}
