import * as React from "react";
import { cn } from "@/lib/utils";

/* Theme-aware charts, "Depth & Glass" edition. Single-series on the
   accent by default (title names the series → no legend). Fat rounded
   bars, max bar solid with a value bubble; others dimmed, hover reveals. */

export function MiniBars({
  data,
  labels,
  color = "var(--accent)",
  height = 64,
  format = (v: number) => String(v),
  className,
  hatch,
}: {
  data: number[];
  labels?: string[];
  color?: string;
  height?: number;
  format?: (v: number) => string;
  className?: string;
  /** render non-max bars as 45° hatched fill instead of dimmed solid */
  hatch?: boolean;
}) {
  const max = Math.max(...data, 1);
  const maxIdx = data.indexOf(Math.max(...data));
  return (
    // extra top padding = headroom for the value bubble above the tallest bar
    <div
      className={cn("flex items-end gap-1.5", className)}
      style={{ height: height + 22, paddingTop: 22 }}
    >
      {data.map((v, i) => {
        const isMax = i === maxIdx && v > 0;
        return (
          <div key={i} className="group relative flex h-full flex-1 items-end">
            <div
              className={cn(
                "relative w-full rounded-t-[6px] rounded-b-[3px] transition-[filter] duration-200 group-hover:brightness-110",
                !isMax && hatch && "hatch",
              )}
              style={{
                height: `${Math.max(4, (v / max) * 100)}%`,
                ...(!isMax && hatch
                  ? { color, opacity: 0.55 }
                  : { background: color, opacity: isMax ? 1 : 0.35 }),
              }}
            >
              <span
                className={cn(
                  "chart-bubble tabular",
                  isMax ? "" : "pointer-events-none opacity-0 group-hover:opacity-100",
                )}
              >
                {labels ? `${labels[i]} · ${format(v)}` : format(v)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Sparkline({
  data,
  color = "var(--accent)",
  height = 48,
  fill = true,
}: {
  data: number[];
  color?: string;
  height?: number;
  fill?: boolean;
}) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const n = data.length;
  const pts = data.map((v, i) => {
    const x = (i / (n - 1)) * 100;
    const y = 100 - ((v - min) / range) * 90 - 5;
    return [x, y] as const;
  });
  const line = pts.map((p) => p.join(",")).join(" ");
  const area = `0,100 ${line} 100,100`;
  const id = React.useId();

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height, overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.24" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <polygon points={area} fill={`url(#${id})`} />}
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={pts[n - 1][0]}
        cy={pts[n - 1][1]}
        r={3}
        fill={color}
        vectorEffect="non-scaling-stroke"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  );
}

/** Sequential heatmap — one hue, intensity by value (0..1). */
export function Heatmap({
  weeks,
  color = "var(--accent)",
}: {
  weeks: number[][]; // rows of 0..1
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {weeks.map((row, r) => (
        <div key={r} className="flex gap-1">
          {row.map((v, c) => (
            <div
              key={c}
              className="h-4 w-4 rounded-[5px]"
              style={{
                background: v > 0 ? color : "var(--surface-2)",
                opacity: v > 0 ? 0.25 + v * 0.75 : 1,
                boxShadow: v > 0.7 ? `0 0 10px -2px ${color}` : undefined,
              }}
              title={`${Math.round(v * 100)}%`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatTile({
  label,
  value,
  unit,
  hint,
  icon,
  accent,
  delta,
  spark,
  hero,
  pastel,
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: string;
  /** real computed % change only — never invented */
  delta?: number | null;
  /** real series only — never invented */
  spark?: number[];
  /** the page's ONE gradient hero tile */
  hero?: boolean;
  pastel?: "cream" | "mint" | "lav";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-1.5 p-5",
        hero ? "card-hero" : pastel ? `card-pastel-${pastel}` : "card",
        className,
      )}
    >
      <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
        {label}
        {icon && (
          <span style={hero ? undefined : { color: accent ?? "var(--accent)" }}>{icon}</span>
        )}
      </div>
      <div className="relative z-10 flex items-end gap-2">
        <div className="tabular font-display text-[30px] font-semibold leading-none tracking-tight text-text">
          {value}
          {unit && <span className="ml-1 text-sm font-normal text-faint">{unit}</span>}
        </div>
        {delta !== undefined && delta !== null && (
          <span
            className={cn(
              "tabular mb-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              delta >= 0 ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
            )}
          >
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta) > 99 ? ">99" : Math.abs(delta)}%
          </span>
        )}
      </div>
      {hint && <div className="relative z-10 text-[11px] text-faint">{hint}</div>}
      {spark && spark.length > 1 && (
        <div className="pointer-events-none absolute bottom-3 right-4 w-16 opacity-80">
          <Sparkline data={spark} height={22} />
        </div>
      )}
    </div>
  );
}
