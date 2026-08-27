"use client";

import { getNorthStarMeta } from "@/lib/data/domains/goals";
import { DynamicIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

export function CategoryPill({
  category,
  customColor,
  active,
  onClick,
}: {
  category: string;
  customColor?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const meta = getNorthStarMeta(category);
  const displayColor = customColor || meta.color;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium transition-all",
        active
          ? "bg-surface-3 text-text shadow-sm"
          : "bg-surface-2 text-muted hover:bg-surface-hover hover:text-text",
      )}
    >
      <span
        className="grid h-4 w-4 place-items-center rounded-full text-xs"
        style={{ backgroundColor: `${displayColor}25`, color: displayColor }}
      >
        <DynamicIcon name={meta.icon} className="h-2.5 w-2.5" />
      </span>
      <span>{meta.title}</span>
    </button>
  );
}
