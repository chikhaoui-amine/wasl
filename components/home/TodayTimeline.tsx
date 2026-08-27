"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useBlocksData, type Block } from "@/lib/data/domains/blocks";
import { BlockForm } from "@/components/forms/BlockForm";
import { todayISO } from "@/lib/date";

const HOUR_H = 46;

const fmtTime = (h: number) => {
  const hr = Math.floor(h);
  const m = Math.round((h - hr) * 60);
  return `${hr}:${`${m}`.padStart(2, "0")}`;
};

export function TodayTimeline() {
  const { blocks } = useBlocksData();
  const [creating, setCreating] = useState<{ date: string; start: number } | null>(null);
  const [editing, setEditing] = useState<Block | undefined>();

  const t = todayISO();
  const todayBlocks = blocks.filter((b) => b.date === t);

  // visible range hugs your day: 7:00–22:00 min, stretched by blocks
  const startH = Math.min(7, ...todayBlocks.map((b) => Math.floor(b.start)));
  const endH = Math.max(22, ...todayBlocks.map((b) => Math.ceil(b.end)));
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i);
  const y = (hour: number) => (hour - startH) * HOUR_H;

  const now = new Date();
  const nowDec = now.getHours() + now.getMinutes() / 60;

  const onSlotClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = startH + (e.clientY - rect.top) / HOUR_H;
    const start = Math.max(startH, Math.min(endH - 0.5, Math.round(raw * 2) / 2));
    setCreating({ date: t, start });
  };

  return (
    <div className="card-glass flex h-full flex-col p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-faint">Today&apos;s plan</h2>
        <Link href="/calendar" className="flex items-center gap-1 text-[12px] font-medium text-accent hover:opacity-80">
          Calendar <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="relative flex-1 overflow-y-auto rounded-[10px]" style={{ maxHeight: 480 }}>
        <div className="relative ml-9" style={{ height: (endH - startH) * HOUR_H }}>
          {/* hour lines + labels */}
          {hours.map((h) => (
            <div key={h} className="absolute inset-x-0" style={{ top: y(h) }}>
              <span className="tabular absolute -left-9 -translate-y-1/2 text-[9px] text-faint">
                {h}:00
              </span>
              <div className="border-t border-border" />
            </div>
          ))}

          {/* click layer */}
          <div className="absolute inset-0 cursor-copy" onClick={onSlotClick} />

          {/* blocks */}
          {todayBlocks.map((b) => {
            const h = (b.end - b.start) * HOUR_H;
            return (
              <button
                key={b.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(b);
                }}
                className="absolute inset-x-0 z-20 overflow-hidden rounded-[10px] px-2 py-1 text-left transition-transform hover:scale-[1.01]"
                style={{
                  top: y(b.start) + 1,
                  height: Math.max(h - 2, 16),
                  background: `linear-gradient(90deg, color-mix(in oklab, ${b.color} 26%, var(--surface)), color-mix(in oklab, ${b.color} 10%, var(--surface)))`,
                  borderLeft: `3px solid ${b.color}`,
                  boxShadow: `inset 3px 0 8px -4px ${b.color}`,
                }}
              >
                <span className="tabular block text-[8px] leading-none text-faint">
                  {fmtTime(b.start)}–{fmtTime(b.end)}
                </span>
                <span className="line-clamp-1 text-[11px] font-medium text-text">{b.title}</span>
              </button>
            );
          })}

          {/* now line */}
          {nowDec >= startH && nowDec <= endH && (
            <div className="pointer-events-none absolute inset-x-0 z-30" style={{ top: y(nowDec) }}>
              <div className="relative border-t-2 border-danger">
                <span className="pulse-dot absolute -left-1 -top-[5px] h-2.5 w-2.5 rounded-full bg-danger text-danger" />
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="mt-2 text-center text-[10px] text-faint">Click a slot to block time.</p>

      <BlockForm open={!!creating} onClose={() => setCreating(null)} defaults={creating ?? undefined} />
      <BlockForm open={!!editing} onClose={() => setEditing(undefined)} block={editing} />
    </div>
  );
}
