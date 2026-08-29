"use client";

import { Moon, Sunrise, Sun, Sunset, type LucideProps } from "lucide-react";
import { greeting } from "@/lib/utils";
import { TodayTimeline } from "@/components/home/TodayTimeline";
import { TodayFocus } from "@/components/home/TodayFocus";
import { HabitsWidget } from "@/components/home/HabitsWidget";
import { SafeBoundary } from "@/components/ui/SafeBoundary";
import { Hydrate } from "@/lib/hydration";
import { todayISO } from "@/lib/date";

/** Decorative glyph matching the same hour buckets as greeting(). */
function TimeGlyph(props: LucideProps) {
  const h = new Date().getHours();
  if (h < 5 || h >= 21) return <Moon {...props} />;
  if (h < 12) return <Sunrise {...props} />;
  if (h < 17) return <Sun {...props} />;
  return <Sunset {...props} />;
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
      <div className="space-y-4 sm:space-y-5">
        {/* Hero */}
        <section className="card-hero p-3.5 sm:p-6 md:p-7">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full opacity-25 blur-2xl"
            style={{ background: "var(--hero-fg)" }}
          />
          <TimeGlyph
            aria-hidden
            strokeWidth={1.1}
            className="pointer-events-none absolute -bottom-4 -right-4 h-16 w-16 sm:h-28 sm:w-28 opacity-[0.16] md:h-36 md:w-36"
            style={{ color: "var(--hero-fg)" }}
          />
          <p className="relative z-10 text-[10.5px] sm:text-[12px] font-medium uppercase tracking-[0.14em] text-faint">
            {dateStr}
          </p>
          <h1 className="relative z-10 mt-0.5 sm:mt-1 font-display text-[19px] sm:text-[28px] md:text-[38px] font-semibold tracking-tight">
            <span className="font-normal text-muted">{greeting()}.</span>
          </h1>
        </section>

        {/* 3-Column Top Grid: Today's Focus (Tasks) + Habits Today + Today's Plan (Calendar) */}
        <div className="grid grid-cols-1 gap-3.5 sm:gap-5 lg:grid-cols-3">
          <SafeBoundary fallbackTitle="Unable to load tasks focus.">
            <TodayFocus date={t} />
          </SafeBoundary>
          <SafeBoundary fallbackTitle="Unable to load habits widget.">
            <HabitsWidget date={t} />
          </SafeBoundary>
          <SafeBoundary fallbackTitle="Unable to load calendar timeline.">
            <TodayTimeline />
          </SafeBoundary>
        </div>
      </div>
    </Hydrate>
  );
}
