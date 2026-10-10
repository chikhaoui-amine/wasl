import { cn } from "@/lib/utils";

interface PaceBarProps {
  value: number;
  /** Where progress "should" be today. Renders a tick when provided. */
  expected?: number | null;
  color?: string;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

export function PaceBar({ value, expected, color, label, size = "md", className }: PaceBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const tick = expected === null || expected === undefined ? null : Math.min(100, Math.max(0, expected));
  const fill = color ?? "var(--accent)";

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn("relative w-full", size === "sm" ? "h-1.5" : "h-2", className)}
    >
      <div className="absolute inset-0 overflow-hidden rounded-pill bg-surface-2 shadow-[inset_0_1px_2px_rgb(0_0_0/0.15)]">
        <div
          className="h-full rounded-pill transition-[width] duration-700 ease-out"
          style={{ width: `${clamped}%`, background: fill }}
        />
      </div>
      {tick !== null && tick > 0 && tick < 100 && (
        <span
          aria-hidden="true"
          title={`Expected by today: ${tick}%`}
          className={cn(
            "absolute top-1/2 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-text/70 ring-2 ring-bg",
            size === "sm" ? "h-3" : "h-3.5",
          )}
          style={{ left: `${tick}%` }}
        />
      )}
    </div>
  );
}
