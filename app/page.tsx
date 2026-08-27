"use client";

import Link from "next/link";
import { ArrowRight, Check, Flame, Moon, Repeat, Sun, Sunrise, Sunset, type LucideProps } from "lucide-react";
import { greeting } from "@/lib/utils";
import { useHabitsData, habitStreak } from "@/lib/data/domains/habits";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { TodayTimeline } from "@/components/home/TodayTimeline";
import { TodayFocus } from "@/components/home/TodayFocus";
import { SafeBoundary } from "@/components/ui/SafeBoundary";
import { Hydrate } from "@/lib/hydration";
import { todayISO } from "@/lib/date";
import { DynamicIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

/** Decorative glyph matching the same hour buckets as greeting(). */
function TimeGlyph(props: LucideProps) {
  const h = new Date().getHours();
  if (h < 5 || h >= 21) return <Moon {...props} />;
  if (h < 12) return <Sunrise {...props} />;
  if (h < 17) return <Sun {...props} />;
  return <Sunset {...props} />;
}

function HabitsWidget() {
  const { habits, toggleDay } = useHabitsData();
  const t = todayISO();

  const total = habits.length;
  const doneToday = habits.filter((h) => !!h.log[t]).length;

  return (
    <Card className="flex h-full flex-col p-4 sm:p-5">
      <SectionTitle
        action={
          <div className="flex items-center gap-3">
            {total > 0 && (
              <span className="tabular text-[11px] text-faint">
                {doneToday}/{total} done
              </span>
            )}
            <Link
              href="/habits"
              className="flex items-center gap-1 text-[11px] font-medium text-accent hover:opacity-80"
            >
              All habits <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        }
      >
        Habits Today
      </SectionTitle>

      {total === 0 ? (
        <div className="flex flex-1 min-h-24 sm:min-h-28 flex-col items-center justify-center text-center">
          <Repeat className="mb-2 h-7 w-7 text-faint opacity-40" />
          <p className="text-[12px] sm:text-[13px] font-medium text-muted">No habits tracked yet.</p>
          <Link
            href="/habits"
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 sm:py-2 text-[12px] font-medium text-accent transition-colors hover:bg-accent-soft"
          >
            Create first habit →
          </Link>
        </div>
      ) : (
        <div className="flex-1 space-y-2 overflow-y-auto max-h-[480px]">
          {habits.map((h) => {
            const done = !!h.log[t];
            const streak = habitStreak(h);

            return (
              <div
                key={h.id}
                className={cn(
                  "group flex items-center justify-between gap-3 rounded-[12px] sm:rounded-[14px] border p-2.5 sm:p-3 transition-all",
                  done
                    ? "border-success/20 bg-success/5"
                    : "border-border/70 bg-surface-2/45 hover:border-border hover:bg-surface-2/75",
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleDay(h.id, t)}
                  aria-pressed={done}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 sm:gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  <span
                    aria-hidden
                    className="grid h-8 w-8 sm:h-9 sm:w-9 shrink-0 place-items-center rounded-[10px]"
                    style={{ background: `${h.color}22` }}
                  >
                    <DynamicIcon name={h.icon} className="h-4 w-4" style={{ color: h.color }} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className={cn("truncate text-[13px] font-medium", done ? "text-muted line-through" : "text-text")}>
                        {h.name}
                      </span>
                      {streak > 1 && (
                        <span className="tabular flex items-center gap-0.5 text-[10.5px] font-semibold text-warn">
                          <Flame className="h-3 w-3" /> {streak}
                        </span>
                      )}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleDay(h.id, t)}
                  aria-label={done ? `${h.name}: mark incomplete` : `${h.name}: mark complete for today`}
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-[8px] border transition-all",
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

export default function HomePage() {
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const t = todayISO();

  return (
    <Hydrate>
      <div className="space-y-5">
        {/* Hero */}
        <section className="card-hero p-4 sm:p-6 md:p-7">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full opacity-25 blur-2xl"
            style={{ background: "var(--hero-fg)" }}
          />
          <TimeGlyph
            aria-hidden
            strokeWidth={1.1}
            className="pointer-events-none absolute -bottom-5 -right-5 h-20 w-20 sm:h-28 sm:w-28 opacity-[0.16] md:h-36 md:w-36"
            style={{ color: "var(--hero-fg)" }}
          />
          <p className="relative z-10 text-[11px] sm:text-[12px] font-medium uppercase tracking-[0.14em] text-faint">
            {dateStr}
          </p>
          <h1 className="relative z-10 mt-1 font-display text-[22px] sm:text-[28px] md:text-[38px] font-semibold tracking-tight">
            <span className="font-normal text-muted">{greeting()}.</span>
          </h1>
        </section>

        {/* 3-Column Top Grid: Today's Focus (Tasks) + Habits Today + Today's Plan (Calendar) */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <SafeBoundary fallbackTitle="Unable to load tasks focus.">
            <TodayFocus date={t} />
          </SafeBoundary>
          <SafeBoundary fallbackTitle="Unable to load habits widget.">
            <HabitsWidget />
          </SafeBoundary>
          <SafeBoundary fallbackTitle="Unable to load calendar timeline.">
            <TodayTimeline />
          </SafeBoundary>
        </div>
      </div>
    </Hydrate>
  );
}

