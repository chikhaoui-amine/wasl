"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useBlocksData, type Block } from "@/lib/data/domains/blocks";
import { BlockForm } from "@/components/forms/BlockForm";
import { Hydrate } from "@/lib/hydration";
import { addDays, fromISO, todayISO, weekISO } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  pxToHour,
  snap,
  clamp,
  computeMove,
  computeResizeTop,
  computeResizeBottom,
  computeCreateRange,
} from "@/lib/calendar/geometry";

const HOUR_H = 54;
const DAY_START = 5;
const DAY_END = 23;
const HOURS = Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => DAY_START + i);
const TOTAL_H = (DAY_END - DAY_START) * HOUR_H;
const EDGE_PX = 7; // resize handle thickness
const DRAG_PX = 4; // movement beyond this = drag (else click)

const fmtHour = (h: number) => {
  const ampm = h < 12 ? "am" : "pm";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${ampm}`;
};
const fmtTime = (h: number) => {
  const hr = Math.floor(h);
  const m = Math.round((h - hr) * 60);
  return `${hr}:${`${m}`.padStart(2, "0")}`;
};
const y = (hour: number) => (hour - DAY_START) * HOUR_H;

type Range = { start: number; end: number };
type Draft =
  | { kind: "create"; range: Range }
  | { kind: "block"; id: string; range: Range }
  | null;

export default function CalendarPage() {
  const { blocks, view, setView, anchor: storeAnchor, setAnchor } = useBlocksData();

  const t = todayISO();
  const currentWeekStart = weekISO(fromISO(t))[0];
  const anchor = storeAnchor || currentWeekStart;

  const [creating, setCreating] = useState<{ date: string; start: number; end?: number } | null>(null);
  const [editing, setEditing] = useState<Block | undefined>();

  const rolling7 = Array.from({ length: 7 }, (_, i) => addDays(anchor, i));
  const cols = view === "week" ? rolling7 : [anchor];

  const now = new Date();
  const nowDec = now.getHours() + now.getMinutes() / 60;

  const shift = (dir: 1 | -1) => setAnchor(addDays(anchor, dir));
  const shiftDay = (dir: 1 | -1) => setAnchor(addDays(anchor, dir));

  const monthLabel = fromISO(cols[0]).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <Hydrate>
      <div className="space-y-4">
        {/* toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex gap-0.5 rounded-pill bg-surface-2 p-0.5">
              {(["week", "day"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "rounded-pill px-2.5 sm:px-3 py-1 text-[11px] sm:text-[12px] font-medium capitalize transition-colors",
                    view === v ? "bg-surface text-text shadow-sm" : "text-faint hover:text-muted",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-0.5">
              <button onClick={() => shift(-1)} aria-label="Previous" className="grid h-7.5 w-7.5 sm:h-8 sm:w-8 place-items-center rounded-[8px] border border-border text-muted hover:bg-surface-hover">
                <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
              <button
                onClick={() => setAnchor(view === "week" ? currentWeekStart : t)}
                className="rounded-[8px] border border-border px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-[12px] font-medium text-muted transition-colors hover:bg-surface-hover hover:text-text"
              >
                Today
              </button>
              <button onClick={() => shift(1)} aria-label="Next" className="grid h-7.5 w-7.5 sm:h-8 sm:w-8 place-items-center rounded-[8px] border border-border text-muted hover:bg-surface-hover">
                <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>

            <span className="hidden text-[13px] font-medium text-muted sm:inline">{monthLabel}</span>
          </div>

          <button
            onClick={() => setCreating({ date: view === "day" ? anchor : t, start: 9 })}
            className="btn-hero flex items-center gap-1 sm:gap-1.5 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-[13px] font-semibold"
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> New block
          </button>
        </div>

        {/* day headers with navigation arrows */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftDay(-1)}
            title="Previous day"
            aria-label="Previous day"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border/80 bg-surface-1 text-faint transition-all hover:bg-surface-2 hover:text-accent hover:border-accent/40 active:scale-95 shadow-sm"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="grid flex-1 gap-px" style={{ gridTemplateColumns: `48px repeat(${cols.length}, minmax(0,1fr))` }}>
            <div />
            {cols.map((iso) => {
              const d = fromISO(iso);
              const isToday = iso === t;
              return (
                <button
                  key={iso}
                  onClick={() => {
                    setView("day");
                    setAnchor(iso);
                  }}
                  className="flex flex-col items-center gap-0.5 py-1 group"
                >
                  <span className={cn("text-[11px] font-medium uppercase tracking-wide group-hover:text-accent transition-colors", isToday ? "text-accent font-semibold" : "text-faint")}>
                    {d.toLocaleDateString("en-US", { weekday: "short" })}
                  </span>
                  <span
                    className={cn(
                      "tabular grid h-7 w-7 place-items-center rounded-full text-[13px] font-semibold transition-transform group-hover:scale-110",
                      isToday ? "bg-accent text-accent-fg shadow-sm" : "text-muted",
                    )}
                  >
                    {d.getDate()}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => shiftDay(1)}
            title="Next day"
            aria-label="Next day"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border/80 bg-surface-1 text-faint transition-all hover:bg-surface-2 hover:text-accent hover:border-accent/40 active:scale-95 shadow-sm"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* grid */}
        <div className="card overflow-y-auto" style={{ maxHeight: "min(68vh, 680px)" }}>
          <div
            className="grid gap-px"
            style={{ gridTemplateColumns: `48px repeat(${cols.length}, minmax(0,1fr))`, height: TOTAL_H }}
          >
            <div className="relative">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="tabular absolute -translate-y-1/2 pr-2 text-right text-[10px] text-faint"
                  style={{ top: y(h), right: 0, width: 46 }}
                >
                  {h > DAY_START ? fmtHour(h) : ""}
                </div>
              ))}
            </div>

            {cols.map((iso) => (
              <DayColumn
                key={iso}
                iso={iso}
                blocks={blocks.filter((b) => b.date === iso)}
                isToday={iso === t}
                nowDec={nowDec}
                onCreateRange={(date, start, end) => setCreating({ date, start, end })}
                onBlockClick={setEditing}
              />
            ))}
          </div>
        </div>

        <p className="text-center text-[12px] text-faint">
          Drag on the grid to block out time · drag a block to move it, its edges to resize · Ctrl-drag to copy to another day · click to edit.
        </p>
      </div>

      <BlockForm
        open={!!creating}
        onClose={() => setCreating(null)}
        defaults={creating ?? undefined}
      />
      <BlockForm open={!!editing} onClose={() => setEditing(undefined)} block={editing} />
    </Hydrate>
  );
}

function DayColumn({
  iso,
  blocks,
  isToday,
  nowDec,
  onCreateRange,
  onBlockClick,
}: {
  iso: string;
  blocks: Block[];
  isToday: boolean;
  nowDec: number;
  onCreateRange: (iso: string, start: number, end?: number) => void;
  onBlockClick: (b: Block) => void;
}) {
  const colRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Draft>(null);
  const { updateBlock, addBlock } = useBlocksData();

  const hourAt = (clientY: number) => {
    const rect = colRef.current!.getBoundingClientRect();
    return pxToHour(clientY, rect.top, HOUR_H, DAY_START);
  };

  // Begin a create-drag on the empty grid.
  const onGridPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const anchorHour = clamp(snap(hourAt(e.clientY)), DAY_START, DAY_END);
    const startY = e.clientY;
    let moved = false;

    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientY - startY) > DRAG_PX) moved = true;
      setDraft({ kind: "create", range: computeCreateRange(anchorHour, hourAt(ev.clientY), DAY_START, DAY_END) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDraft(null);
      if (moved) {
        const r = computeCreateRange(anchorHour, hourAt(ev.clientY), DAY_START, DAY_END);
        onCreateRange(iso, r.start, r.end);
      } else {
        onCreateRange(iso, anchorHour); // plain click → form defaults end to +1h
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Begin move / resize on an existing block.
  const onBlockPointerDown = (e: React.PointerEvent<HTMLDivElement>, b: Block) => {
    if (e.button !== 0) return;
    e.stopPropagation(); // don't also start a create-drag
    const rect = e.currentTarget.getBoundingClientRect();
    const offY = e.clientY - rect.top;
    const mode: "move" | "top" | "bottom" =
      offY < EDGE_PX ? "top" : offY > rect.height - EDGE_PX ? "bottom" : "move";
    const grabOffset = hourAt(e.clientY) - b.start;
    const dur = b.end - b.start;
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    let last: Range = { start: b.start, end: b.end };

    const isCopy = (ev: PointerEvent) => mode === "move" && (ev.ctrlKey || ev.metaKey);

    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) > DRAG_PX || Math.abs(ev.clientY - startY) > DRAG_PX) moved = true;
      const ph = hourAt(ev.clientY);
      last =
        mode === "move"
          ? computeMove(ph, grabOffset, dur, DAY_START, DAY_END)
          : mode === "top"
            ? computeResizeTop(ph, b.end, DAY_START)
            : computeResizeBottom(ph, b.start, DAY_END);
      // While Ctrl/Cmd-copying, leave the original in place — the copy lands on drop.
      if (isCopy(ev)) setDraft(null);
      else setDraft({ kind: "block", id: b.id, range: last });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDraft(null);
      if (moved && isCopy(ev)) {
        // drop-target day comes from whatever column is under the pointer
        const col = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest(
          "[data-iso]",
        ) as HTMLElement | null;
        const targetIso = col?.dataset.iso ?? iso;
        addBlock({
          date: targetIso,
          start: last.start,
          end: last.end,
          title: b.title,
          color: b.color,
        });
      } else if (moved) {
        updateBlock(b.id, { start: last.start, end: last.end });
      } else {
        onBlockClick(b);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      ref={colRef}
      data-iso={iso}
      className="relative cursor-copy touch-none select-none border-l border-border"
      style={{
        backgroundImage: `repeating-linear-gradient(var(--border) 0 1px, transparent 1px ${HOUR_H}px)`,
      }}
      onPointerDown={onGridPointerDown}
    >
      {/* create-drag ghost */}
      {draft?.kind === "create" && (
        <div
          className="pointer-events-none absolute inset-x-1 z-20 rounded-[10px] border border-dashed border-accent bg-accent-soft/60"
          style={{ top: y(draft.range.start) + 1, height: Math.max((draft.range.end - draft.range.start) * HOUR_H - 2, 16) }}
        >
          <span className="tabular block px-2 py-1 text-[9px] font-medium text-accent">
            {fmtTime(draft.range.start)}–{fmtTime(draft.range.end)}
          </span>
        </div>
      )}

      {blocks.map((b) => {
        const live = draft?.kind === "block" && draft.id === b.id ? draft.range : b;
        const h = (live.end - live.start) * HOUR_H;
        const dragging = draft?.kind === "block" && draft.id === b.id;
        const isShort = h < 38;
        const isAccent = b.color === "var(--accent)";

        return (
          <div
            key={b.id}
            onPointerDown={(e) => onBlockPointerDown(e, b)}
            className={cn(
              "group absolute inset-x-1 z-10 cursor-grab overflow-hidden rounded-[8px] text-left transition-transform shadow-sm",
              dragging ? "z-30 cursor-grabbing shadow-xl ring-2 ring-white/50 scale-[1.02]" : "hover:scale-[1.01] hover:shadow-md",
              isShort ? "flex items-center px-2 py-0" : "flex flex-col justify-start px-2.5 py-1.5",
              isAccent ? "text-accent-fg" : "text-white",
            )}
            style={{
              top: y(live.start) + 1,
              height: Math.max(h - 2, 20),
              backgroundColor: b.color,
              border: isAccent ? "1px solid var(--border)" : "1px solid rgba(0, 0, 0, 0.15)",
            }}
          >
            {/* resize handles (visual cursor only; hit-test uses offsetY) */}
            <span className="pointer-events-none absolute inset-x-0 top-0 h-[6px] cursor-ns-resize" />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[6px] cursor-ns-resize" />

            {isShort ? (
              <div className="flex w-full min-w-0 items-center gap-1.5 leading-none">
                <span className={cn("tabular text-[9px] font-medium shrink-0", isAccent ? "text-accent-fg/80" : "text-white/80")}>
                  {fmtTime(live.start)}
                </span>
                <span className={cn("truncate text-[11px] font-semibold", isAccent ? "text-accent-fg" : "text-white")}>
                  {b.title}
                </span>
              </div>
            ) : (
              <>
                <span className={cn("tabular block text-[9px] font-medium leading-tight", isAccent ? "text-accent-fg/80" : "text-white/80")}>
                  {fmtTime(live.start)}–{fmtTime(live.end)}
                </span>
                <span className={cn("line-clamp-2 text-[11.5px] font-semibold leading-tight mt-0.5", isAccent ? "text-accent-fg" : "text-white")}>
                  {b.title}
                </span>
              </>
            )}
          </div>
        );
      })}

      {isToday && nowDec >= DAY_START && nowDec <= DAY_END && (
        <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: y(nowDec) }}>
          <div className="relative border-t-2 border-danger">
            <span className="pulse-dot absolute -left-0.5 -top-[5px] h-2.5 w-2.5 rounded-full bg-danger text-danger" />
          </div>
        </div>
      )}
    </div>
  );
}
