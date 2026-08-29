"use client";

import Link from "next/link";
import { ArrowRight, Check, Flame, Repeat } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { useHabitsData, habitStreak, type Habit } from "@/lib/data/domains/habits";
import { todayISO } from "@/lib/date";
import { DynamicIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

interface HabitsWidgetCardProps {
  ready?: boolean;
  habits: Habit[];
  today?: string;
  onToggleDay?: (habitId: string, date: string) => void;
}

export function HabitsWidgetCard({
  ready = true,
  habits,
  today = todayISO(),
  onToggleDay,
}: HabitsWidgetCardProps) {
  if (!ready) {
    return (
      <Card className="flex h-full flex-col p-3.5 sm:p-5">
        <SectionTitle>Habits Today</SectionTitle>
        <p className="py-7 text-center text-[13px] text-faint" aria-live="polite">
          Preparing habits…
        </p>
      </Card>
    );
  }

  const total = habits.length;
  const doneToday = habits.filter((h) => !!h.log?.[today]).length;

  return (
    <Card className="flex h-full flex-col p-3.5 sm:p-5">
      <SectionTitle
        action={
          <div className="flex items-center gap-2 sm:gap-3">
            {total > 0 && (
              <span className="tabular text-[10.5px] sm:text-[11px] text-faint">
                {doneToday}/{total} done
              </span>
            )}
            <Link
              href="/habits"
              className="flex items-center gap-1 text-[10.5px] sm:text-[11px] font-medium text-accent hover:opacity-80"
            >
              All habits <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        }
      >
        Habits Today
      </SectionTitle>

      {total === 0 ? (
        <div className="flex flex-1 min-h-20 sm:min-h-28 flex-col items-center justify-center text-center">
          <Repeat className="mb-2 h-6 w-6 sm:h-7 sm:w-7 text-faint opacity-40" />
          <p className="text-[12px] sm:text-[13px] font-medium text-muted">No habits tracked yet.</p>
          <Link
            href="/habits"
            className="mt-2 inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 sm:py-2 text-[11.5px] sm:text-[12px] font-medium text-accent transition-colors hover:bg-accent-soft"
          >
            Create first habit →
          </Link>
        </div>
      ) : (
        <div className="flex-1 space-y-1.5 sm:space-y-2 overflow-y-auto max-h-[480px]">
          {habits.map((h) => {
            const done = !!h.log?.[today];
            const streak = habitStreak(h);

            return (
              <div
                key={h.id}
                className={cn(
                  "group flex items-center justify-between gap-2.5 sm:gap-3 rounded-[12px] sm:rounded-[14px] border p-2 sm:p-3 transition-all",
                  done
                    ? "border-success/20 bg-success/5"
                    : "border-border/70 bg-surface-2/45 hover:border-border hover:bg-surface-2/75",
                )}
              >
                <button
                  type="button"
                  onClick={() => onToggleDay?.(h.id, today)}
                  aria-pressed={done}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 sm:gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  <span
                    aria-hidden
                    className="grid h-7.5 w-7.5 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-[9px] sm:rounded-[10px]"
                    style={{ background: `${h.color}22` }}
                  >
                    <DynamicIcon name={h.icon} className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ color: h.color }} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "truncate text-[12.5px] sm:text-[13px] font-medium",
                          done ? "text-muted line-through" : "text-text",
                        )}
                      >
                        {h.name}
                      </span>
                      {streak > 1 && (
                        <span className="tabular flex items-center gap-0.5 text-[10px] font-semibold text-warn">
                          <Flame className="h-3 w-3" /> {streak}
                        </span>
                      )}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleDay?.(h.id, today)}
                  aria-label={done ? `${h.name}: mark incomplete` : `${h.name}: mark complete for today`}
                  className={cn(
                    "grid h-6.5 w-6.5 sm:h-7 sm:w-7 shrink-0 place-items-center rounded-[8px] border transition-all",
                    done
                      ? "border-success bg-success text-bg shadow-xs"
                      : "border-border-strong text-transparent group-hover:border-accent group-hover:text-accent/40",
                  )}
                  title={done ? "Mark incomplete" : "Mark complete for today"}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export function HabitsWidget({ date }: { date?: string }) {
  const { habits, toggleDay, isLoading } = useHabitsData();
  const t = date || todayISO();

  return (
    <HabitsWidgetCard
      ready={!isLoading}
      habits={habits}
      today={t}
      onToggleDay={toggleDay}
    />
  );
}
