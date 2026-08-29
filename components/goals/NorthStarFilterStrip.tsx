"use client";

import { Compass, Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NorthStarItem {
  id: string;
  title: string;
  description?: string;
  color?: string;
  count: number;
  isUserCreated?: boolean;
}

interface NorthStarFilterStripProps {
  northStars: NorthStarItem[];
  selectedId: string | null;
  totalGoalsCount: number;
  onSelect: (id: string | null) => void;
  onAddNorthStar: () => void;
  onEditNorthStar?: (ns: NorthStarItem) => void;
  onDeleteNorthStar?: (ns: NorthStarItem) => void;
  className?: string;
}

export function NorthStarFilterStrip({
  northStars,
  selectedId,
  totalGoalsCount,
  onSelect,
  onAddNorthStar,
  onEditNorthStar,
  onDeleteNorthStar,
  className,
}: NorthStarFilterStripProps) {
  const selectedNS = selectedId ? northStars.find((ns) => ns.id === selectedId) : null;

  return (
    <div className={cn("space-y-2.5", className)}>
      {/* Scrollable / Wrapping Chip Bar */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {/* All Goals Chip */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all border",
            selectedId === null
              ? "bg-text text-bg border-text shadow-xs"
              : "bg-surface-2/80 text-muted border-border/70 hover:border-border-strong hover:text-text",
          )}
        >
          <Compass className="h-3.5 w-3.5" />
          <span>All Directions</span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.2 text-[10px] tabular-nums font-bold",
              selectedId === null ? "bg-bg/20 text-bg" : "bg-surface-3 text-faint",
            )}
          >
            {totalGoalsCount}
          </span>
        </button>

        {/* Individual North Star Chips */}
        {northStars.map((ns) => {
          const isSelected = selectedId === ns.id;
          const color = ns.color || "#b57edc";

          return (
            <button
              key={ns.id}
              type="button"
              onClick={() => onSelect(isSelected ? null : ns.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all border",
                isSelected
                  ? "bg-accent text-white border-accent shadow-xs"
                  : "bg-surface-2/80 text-muted border-border/70 hover:border-border-strong hover:text-text",
              )}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: isSelected ? "#ffffff" : color }}
              />
              <span className="truncate max-w-[140px] sm:max-w-[200px]">{ns.title}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] tabular-nums font-bold",
                  isSelected ? "bg-white/25 text-white" : "bg-surface-3 text-faint",
                )}
              >
                {ns.count}
              </span>
            </button>
          );
        })}

        {/* + Add Direction Button */}
        <button
          type="button"
          onClick={onAddNorthStar}
          className="flex items-center gap-1 rounded-full border border-dashed border-border hover:border-accent px-2.5 py-1 text-xs font-semibold text-muted hover:text-accent transition-colors"
          title="Add new North Star direction"
        >
          <Plus className="h-3 w-3" />
          <span>+ Add Direction</span>
        </button>
      </div>

      {/* Selected Direction Vision Banner */}
      {selectedNS && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-accent/20 bg-accent-soft/15 px-3.5 py-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" />
            <div className="min-w-0 truncate">
              <span className="font-semibold text-text">{selectedNS.title}:</span>{" "}
              <span className="text-muted italic">
                &ldquo;{selectedNS.description || "Lifetime compass and guiding principle"}&rdquo;
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onEditNorthStar && selectedNS.isUserCreated && (
              <button
                type="button"
                onClick={() => onEditNorthStar(selectedNS)}
                className="p-1 rounded-md text-faint hover:text-text hover:bg-surface-2 transition-colors"
                title="Edit North Star"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {onDeleteNorthStar && (
              <button
                type="button"
                onClick={() => onDeleteNorthStar(selectedNS)}
                className="p-1 rounded-md text-faint hover:text-danger hover:bg-danger/10 transition-colors"
                title="Delete or Hide North Star"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
