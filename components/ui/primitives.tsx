import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  hover,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={cn("card", hover && "card-hover", className)}
      {...props}
    />
  );
}

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between", className)}>
      <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-faint flex items-center gap-2">
        {children}
      </h2>
      {action}
    </div>
  );
}

const pillTones = {
  neutral: "bg-surface-2 text-muted",
  accent: "bg-accent-soft text-accent",
  success: "text-success",
  warn: "text-warn",
  danger: "text-danger",
} as const;

export function Pill({
  tone = "neutral",
  className,
  children,
}: {
  tone?: keyof typeof pillTones;
  className?: string;
  children: React.ReactNode;
}) {
  const toneCls =
    tone === "success" || tone === "warn" || tone === "danger"
      ? cn(pillTones[tone], "bg-current/10")
      : pillTones[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium",
        toneCls,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  label,
  className,
  color,
  gradient,
}: {
  value: number;
  /** Accessible name for the bar, e.g. "Quarter progress". */
  label?: string;
  className?: string;
  color?: string;
  /** accent→accent-2 gradient fill for hero contexts */
  gradient?: boolean;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn(
        "h-2 w-full overflow-hidden rounded-pill bg-surface-2 shadow-[inset_0_1px_2px_rgb(0_0_0/0.15)]",
        className,
      )}
    >
      <div
        className="h-full rounded-pill transition-[width] duration-700 ease-out"
        style={{
          width: `${clamped}%`,
          background: gradient
            ? "linear-gradient(90deg, var(--accent), var(--accent-2))"
            : (color ?? "var(--accent)"),
          boxShadow: `0 0 8px -2px ${color ?? "var(--accent)"}`,
        }}
      />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 56,
  stroke = 5,
  color,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(100, Math.max(0, value)))}
      className="relative inline-grid place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color ?? "var(--accent)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
          style={{ filter: `drop-shadow(0 0 5px ${color ?? "var(--accent)"})` }}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
      )}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="tabular rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
      {children}
    </kbd>
  );
}
