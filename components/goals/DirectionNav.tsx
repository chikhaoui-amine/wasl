"use client";

import { Compass, Pencil, Plus } from "lucide-react";
import type { NorthStarPreset } from "@/lib/data/domains/goals";
import { cn } from "@/lib/utils";

export interface DirectionItem {
  id: string;
  title: string;
  description?: string;
  color?: string;
  count: number;
  /** Average progress of the direction's active goals (0–100). */
  progress: number;
  isUserCreated?: boolean;
}

interface DirectionNavProps {
  directions: DirectionItem[];
  selectedId: string | null;
  totalCount: number;
  suggestions?: NorthStarPreset[];
  onSelect: (id: string | null) => void;
  onAddDirection: () => void;
  onEditDirection?: (id: string) => void;
  onAddSuggestion?: (preset: NorthStarPreset) => void;
  className?: string;
}

/**
 * Directions (North Stars) as a filter. Vertical rail on large screens,
 * a horizontally scrolling chip row on small ones.
 */
export function DirectionNav({
  directions,
  selectedId,
  totalCount,
  suggestions = [],
  onSelect,
  onAddDirection,
  onEditDirection,
  onAddSuggestion,
  className,
}: DirectionNavProps) {
  return (
    <nav aria-label="Life directions" className={cn("min-w-0", className)}>
      {/* Mobile / tablet: chips */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-1 lg:hidden">
        <Chip active={selectedId === null} onClick={() => onSelect(null)}>
          <Compass className="h-3.5 w-3.5" /> All
          <Count active={selectedId === null}>{totalCount}</Count>
        </Chip>
        {directions.map((d) => (
          <Chip
            key={d.id}
            active={selectedId === d.id}
            onClick={() => onSelect(selectedId === d.id ? null : d.id)}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="max-w-[150px] truncate">{d.title}</span>
            {d.count > 0 && <Count active={selectedId === d.id}>{d.count}</Count>}
          </Chip>
        ))}
        <button
          type="button"
          onClick={onAddDirection}
          className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-border-strong px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-text"
        >
          <Plus className="h-3 w-3" /> Direction
        </button>
      </div>

      {/* Desktop: rail */}
      <div className="hidden space-y-5 lg:block">
        <div>
          <div className="mb-2 flex items-center justify-between px-2">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">Directions</h2>
            <button
              type="button"
              onClick={onAddDirection}
              aria-label="New direction"
              title="New direction"
              className="grid h-6 w-6 place-items-center rounded-md text-faint transition-colors hover:bg-surface-2 hover:text-text"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <ul className="space-y-0.5">
            <li>
              <RailItem
                active={selectedId === null}
                onClick={() => onSelect(null)}
                icon={<Compass className="h-3.5 w-3.5" />}
                title="All directions"
                count={totalCount}
              />
            </li>
            {directions.map((d) => (
              <li key={d.id} className="group/item relative">
                <RailItem
                  active={selectedId === d.id}
                  onClick={() => onSelect(selectedId === d.id ? null : d.id)}
                  icon={<span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />}
                  title={d.title}
                  count={d.count}
                  progress={d.count > 0 ? d.progress : undefined}
                  color={d.color}
                  muted={d.count === 0}
                  editable={d.isUserCreated && !!onEditDirection}
                />
                {d.isUserCreated && onEditDirection && (
                  <button
                    type="button"
                    onClick={() => onEditDirection(d.id)}
                    aria-label={`Edit direction ${d.title}`}
                    title="Edit direction"
                    className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md bg-surface-2 text-faint opacity-0 transition-opacity hover:text-text focus-visible:opacity-100 group-hover/item:opacity-100"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {suggestions.length > 0 && onAddSuggestion && (
          <div className="space-y-2 px-2">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">Suggested</h3>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onAddSuggestion(p)}
                  title={p.description}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2/50 px-2.5 py-1 text-[11.5px] font-medium text-muted transition-colors hover:border-border-strong hover:text-text active:scale-95"
                >
                  <Plus className="h-3 w-3" style={{ color: p.color }} />
                  {p.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-text bg-text text-bg"
          : "border-border bg-surface-2/70 text-muted hover:border-border-strong hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

function Count({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("text-[10.5px] font-semibold tabular-nums", active ? "text-bg/70" : "text-faint")}>
      {children}
    </span>
  );
}

function RailItem({
  active,
  onClick,
  icon,
  title,
  count,
  progress,
  color,
  muted,
  editable,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  count: number;
  progress?: number;
  color?: string;
  muted?: boolean;
  editable?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "w-full rounded-xl px-2.5 py-2 text-left transition-colors",
        active ? "bg-surface-2 shadow-[inset_0_0_0_1px_var(--border-strong)]" : "hover:bg-surface-2/60",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="grid h-4 w-4 shrink-0 place-items-center text-muted">{icon}</span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[13px] font-medium",
            active ? "text-text" : muted ? "text-faint" : "text-muted",
          )}
        >
          {title}
        </span>
        <span className={cn("pr-0.5 text-[11px] tabular-nums text-faint", editable && "group-hover/item:invisible")}>
          {count}
        </span>
      </div>
      {progress !== undefined && (
        <div className="ml-[26px] mt-1.5 h-[3px] overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${progress}%`, backgroundColor: color }}
          />
        </div>
      )}
    </button>
  );
}
