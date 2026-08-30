"use client";

import { useRef, useState, useEffect } from "react";
import { Compass, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NorthStarItem {
  id: string;
  title: string;
  description?: string;
  color?: string;
  count: number;
  isUserCreated?: boolean;
}

export interface NorthStarFilterStripProps {
  northStars: NorthStarItem[];
  selectedId: string | null;
  totalGoalsCount: number;
  onSelect: (id: string | null) => void;
  onAddNorthStar: () => void;
  className?: string;
}

export function NorthStarFilterStrip({
  northStars,
  selectedId,
  totalGoalsCount,
  onSelect,
  onAddNorthStar,
  className,
}: NorthStarFilterStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 2;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(hasOverflow && el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;

    const handleResize = () => checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [northStars]);

  const scrollBy = (offset: number) => {
    scrollRef.current?.scrollBy({ left: offset, behavior: "smooth" });
  };

  return (
    <div className={cn("flex items-center gap-1.5 w-full min-w-0", className)}>
      {/* Left Scroll Button */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollBy(-200)}
          className="shrink-0 hidden sm:flex items-center justify-center h-6 w-6 rounded-full border border-border/80 bg-surface-2 text-muted hover:text-text shadow-xs transition-colors"
          aria-label="Scroll directions left"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Scrollable Single-Line Chip Bar */}
      <div
        ref={scrollRef}
        className="flex items-center gap-1.5 sm:gap-2 flex-nowrap overflow-x-auto no-scrollbar scroll-smooth py-1 flex-1 min-w-0"
      >
        {/* All Directions Chip */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            "flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all border",
            selectedId === null
              ? "bg-text text-bg border-text shadow-xs"
              : "bg-surface-2/80 text-muted border-border/70 hover:border-border-strong hover:text-text",
          )}
        >
          <Compass className="h-3.5 w-3.5 shrink-0" />
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
                "flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all border",
                isSelected
                  ? "bg-text text-bg border-text shadow-xs"
                  : "bg-surface-2/80 text-muted border-border/70 hover:border-border-strong hover:text-text",
              )}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="truncate max-w-[140px] sm:max-w-[200px]">{ns.title}</span>
              {ns.count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] tabular-nums font-bold",
                    isSelected ? "bg-bg/20 text-bg" : "bg-surface-3 text-faint",
                  )}
                >
                  {ns.count}
                </span>
              )}
            </button>
          );
        })}

        {/* Add Direction Button */}
        <button
          type="button"
          onClick={onAddNorthStar}
          className="flex items-center gap-1.5 shrink-0 rounded-full border border-dashed border-border/80 hover:border-border-strong hover:bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted hover:text-text transition-colors"
          title="Add new North Star direction"
        >
          <Plus className="h-3 w-3 shrink-0" />
          <span>Add Direction</span>
        </button>
      </div>

      {/* Right Scroll Button */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollBy(200)}
          className="shrink-0 hidden sm:flex items-center justify-center h-6 w-6 rounded-full border border-border/80 bg-surface-2 text-muted hover:text-text shadow-xs transition-colors"
          aria-label="Scroll directions right"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
