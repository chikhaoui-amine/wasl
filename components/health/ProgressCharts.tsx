"use client";

import { useId, useState } from "react";
import {
  Trophy,
  Dumbbell,
  Moon,
  Sparkles,
  Plus,
  Scale,
} from "lucide-react";
import {
  useHealthData,
  weightSeries,
  extractAllPRs,
  sleepSeries,
  exerciseProgression,
  getAvailableExercises,
  formatSetSummary,
} from "@/lib/data/domains/health";
import { Card, SectionTitle } from "@/components/ui/primitives";
import { SleepLoggerModal } from "./SleepLoggerModal";
import { WeightLoggerModal } from "./WeightLoggerModal";
import { addDays, relLabel, todayISO } from "@/lib/date";
import { cn } from "@/lib/utils";

type SleepTimeframe = 7 | 14 | 30;
type WeightTimeframe = 7 | 14 | 30 | 90 | "all";
type ExerciseMetric = "maxWeight" | "e1rm" | "volume";

/* Generate smooth SVG cubic Bezier path from points in 0..100 coordinate space */
function getSmoothSvgPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x},${pts[0].y} L ${pts[0].x + 0.1},${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`;

  let d = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

export function ProgressCharts() {
  const { days, workouts, exercises, goals } = useHealthData();
  const weights = weightSeries(days);
  const prs = extractAllPRs(workouts);

  // Available exercises
  const availableExercises = getAvailableExercises(exercises, workouts);
  const defaultEx =
    availableExercises.find((e) => e.loggedSessionsCount > 0)?.name ||
    availableExercises[0]?.name ||
    "Barbell Bench Press";

  const [selectedEx, setSelectedEx] = useState<string>(defaultEx);
  const [exerciseMetric, setExerciseMetric] = useState<ExerciseMetric>("maxWeight");

  // Sleep State
  const [sleepTimeframe, setSleepTimeframe] = useState<SleepTimeframe>(7);
  const [selectedSleepDate, setSelectedSleepDate] = useState<string>(todayISO());
  const [isSleepModalOpen, setIsSleepModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<string>(todayISO());

  // Bodyweight State
  const [weightTimeframe, setWeightTimeframe] = useState<WeightTimeframe>(14);
  const [selectedWeightDate, setSelectedWeightDate] = useState<string>(todayISO());
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [weightModalDate, setWeightModalDate] = useState<string>(todayISO());

  // Sleep computations
  const sleepData = sleepSeries(days, sleepTimeframe);

  // Exercise progression computations
  const progressionData = exerciseProgression(workouts, selectedEx);
  const currentExStats = availableExercises.find((e) => e.name === selectedEx);

  // Bodyweight computations
  const cutoffDate = weightTimeframe === "all" ? "" : addDays(todayISO(), -Number(weightTimeframe));
  const timeframeWeights = cutoffDate ? weights.filter((w) => w.iso >= cutoffDate) : weights;
  const activeWeights = timeframeWeights.length > 0 ? timeframeWeights : weights.slice(-14);

  const weightVals = activeWeights.map((w) => w.value);
  const currentWeight = activeWeights.at(-1)?.value;
  const startWeight = activeWeights[0]?.value;
  const minWeight = weightVals.length > 0 ? Math.min(...weightVals) : 0;
  const maxWeight = weightVals.length > 0 ? Math.max(...weightVals) : 0;
  const weightDiff =
    currentWeight !== undefined && startWeight !== undefined && activeWeights.length > 1
      ? Number((currentWeight - startWeight).toFixed(1))
      : null;
  const avgWeight =
    weightVals.length > 0
      ? Number((weightVals.reduce((a, b) => a + b, 0) / weightVals.length).toFixed(1))
      : null;

  const gradIdSleep = useId();
  const gradIdEx = useId();
  const gradIdWeight = useId();

  // Exercise metric helper
  const getMetricValue = (pt: (typeof progressionData)[number]) => {
    if (exerciseMetric === "maxWeight") return pt.maxWeightKg;
    if (exerciseMetric === "e1rm") return pt.max1RM;
    return pt.totalVolumeKg;
  };

  const getMetricUnit = () => "kg";

  const openSleepModalForDate = (date: string) => {
    setModalDate(date);
    setIsSleepModalOpen(true);
  };

  const openWeightModalForDate = (date: string) => {
    setWeightModalDate(date);
    setIsWeightModalOpen(true);
  };

  // Percentage improvement for selected exercise
  const firstSession = progressionData[0];
  const latestSession = progressionData.at(-1);
  const improvementPct =
    firstSession && latestSession && firstSession !== latestSession && firstSession.maxWeightKg > 0
      ? Math.round(((latestSession.maxWeightKg - firstSession.maxWeightKg) / firstSession.maxWeightKg) * 100)
      : null;

  /* ================= SLEEP GRAPH COORDINATES ================= */
  const targetH = goals.sleepH || 8;
  const maxSleepScale = Math.max(11, ...sleepData.map((d) => d.sleepH), targetH + 1);
  const nSleep = sleepData.length;

  const sleepCoords = sleepData.map((d, i) => {
    const xPct = nSleep > 1 ? (i / (nSleep - 1)) * 92 + 4 : 50;
    const yRatio = d.sleepH > 0 ? d.sleepH / maxSleepScale : 0.05;
    const yPct = 90 - yRatio * 75; // map between 15% and 90%
    return { x: xPct, y: yPct, data: d };
  });

  const sleepLinePath = getSmoothSvgPath(sleepCoords.map((c) => ({ x: c.x, y: c.y })));
  const sleepAreaPath =
    sleepCoords.length > 0
      ? `${sleepLinePath} L ${sleepCoords[sleepCoords.length - 1].x},100 L ${sleepCoords[0].x},100 Z`
      : "";

  const targetYPct = 90 - (targetH / maxSleepScale) * 75;

  /* ================= EXERCISE GRAPH COORDINATES ================= */
  const nEx = progressionData.length;
  const metricValues = progressionData.map(getMetricValue);
  const minVal = metricValues.length > 0 ? Math.min(...metricValues) : 0;
  const maxVal = metricValues.length > 0 ? Math.max(...metricValues) : 1;
  const exRange = maxVal - minVal || Math.max(10, maxVal * 0.25);
  const exMinY = Math.max(0, minVal - exRange * 0.2);
  const exMaxY = maxVal + exRange * 0.25;

  const exCoords = progressionData.map((pt, i) => {
    const val = getMetricValue(pt);
    const xPct = nEx > 1 ? (i / (nEx - 1)) * 84 + 8 : 50;
    const ratio = (val - exMinY) / (exMaxY - exMinY || 1);
    const yPct = 85 - Math.max(0, Math.min(1, ratio)) * 68; // between 17% and 85%
    return { x: xPct, y: yPct, val, data: pt };
  });

  const exLinePath = getSmoothSvgPath(exCoords.map((c) => ({ x: c.x, y: c.y })));
  const exAreaPath =
    exCoords.length > 0
      ? `${exLinePath} L ${exCoords[exCoords.length - 1].x},100 L ${exCoords[0].x},100 Z`
      : "";

  /* ================= BODYWEIGHT GRAPH COORDINATES ================= */
  const nWeight = activeWeights.length;
  const wDiff = maxWeight - minWeight;
  const wPadding = Math.max(1.0, wDiff * 0.25 || 2.0);
  const wMinY = Math.max(0, minWeight - wPadding);
  const wMaxY = maxWeight + wPadding;

  const weightCoords = activeWeights.map((pt, i) => {
    const xPct = nWeight > 1 ? (i / (nWeight - 1)) * 86 + 7 : 50;
    const ratio = (pt.value - wMinY) / (wMaxY - wMinY || 1);
    const yPct = 85 - Math.max(0, Math.min(1, ratio)) * 68; // maps between 17% and 85%
    return { x: xPct, y: yPct, pt };
  });

  const weightLinePath = getSmoothSvgPath(weightCoords.map((c) => ({ x: c.x, y: c.y })));
  const weightAreaPath =
    weightCoords.length > 0
      ? `${weightLinePath} L ${weightCoords[weightCoords.length - 1].x},100 L ${weightCoords[0].x},100 Z`
      : "";

  return (
    <div className="space-y-6">
      {/* Main 2 Cards Grid: Sleep Records & Exercise Weight Progress */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ================= CARD 1: SLEEP DATA & LINE GRAPH ================= */}
        <Card className="p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header & Timeframe Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-500/15 text-cyan-400">
                  <Moon className="h-4 w-4" />
                </div>
                <div>
                  <SectionTitle>Sleep Records & Trends</SectionTitle>
                  <p className="text-[11px] text-faint">Target: {goals.sleepH || 8} hrs/night</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex items-center rounded-lg bg-surface-2 p-0.5 border border-border/60">
                  {([7, 14, 30] as const).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setSleepTimeframe(tf)}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[11px] font-bold transition",
                        sleepTimeframe === tf
                          ? "bg-accent text-accent-fg shadow-sm"
                          : "text-muted hover:text-text",
                      )}
                    >
                      {tf}D
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => openSleepModalForDate(selectedSleepDate)}
                  className="flex items-center gap-1 rounded-lg bg-accent/15 px-2.5 py-1 text-[11px] font-bold text-accent hover:bg-accent hover:text-accent-fg transition"
                >
                  <Plus className="h-3 w-3" /> Log Sleep
                </button>
              </div>
            </div>

            {/* Sleep Line Chart Container */}
            <div className="space-y-2">
              <div className="relative h-52 w-full rounded-xl bg-surface-2/30 p-2 border border-border/40 overflow-hidden">
                {/* SVG Curves */}
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="absolute inset-0 h-full w-full pointer-events-none"
                >
                  <defs>
                    <linearGradient id={gradIdSleep} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Goal Dashed Line */}
                  <line
                    x1="0"
                    y1={targetYPct}
                    x2="100"
                    y2={targetYPct}
                    stroke="rgb(6 182 212 / 0.4)"
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                    vectorEffect="non-scaling-stroke"
                  />

                  {/* Gradient Area */}
                  {sleepAreaPath && <path d={sleepAreaPath} fill={`url(#${gradIdSleep})`} />}

                  {/* Line Stroke */}
                  {sleepLinePath && (
                    <path
                      d={sleepLinePath}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </svg>

                {/* HTML Goal Badge */}
                <div
                  className="absolute right-2.5 pointer-events-none -translate-y-1/2 rounded bg-surface-1/90 border border-cyan-500/40 px-1.5 py-0.5 text-[9px] font-bold text-cyan-400 shadow-sm z-10"
                  style={{ top: `${targetYPct}%` }}
                >
                  Goal {targetH}h
                </div>

                {/* HTML Interactive Data Points */}
                {sleepCoords.map((coord) => {
                  const isSelected = coord.data.iso === selectedSleepDate;
                  const hasData = coord.data.sleepH > 0;

                  return (
                    <div
                      key={coord.data.iso}
                      style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
                      onClick={() => setSelectedSleepDate(coord.data.iso)}
                      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                    >
                      {/* Tooltip on Hover */}
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center whitespace-nowrap rounded-lg bg-surface-3 px-2 py-1 text-[11px] font-bold text-text shadow-xl border border-border z-30">
                        <span>
                          {coord.data.iso.slice(5)}: {coord.data.sleepH > 0 ? `${coord.data.sleepH} hrs` : "No log"}
                        </span>
                        {coord.data.sleepQuality && (
                          <span className="text-[10px] text-accent font-normal">{coord.data.sleepQuality}</span>
                        )}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-3" />
                      </div>

                      {/* Dot */}
                      <div
                        className={cn(
                          "rounded-full transition-all flex items-center justify-center",
                          isSelected
                            ? "h-4 w-4 bg-cyan-400 ring-4 ring-cyan-400/30 shadow-lg"
                            : hasData
                            ? "h-3 w-3 bg-accent ring-2 ring-surface-1 group-hover:scale-125 group-hover:bg-cyan-300"
                            : "h-2 w-2 bg-surface-3 ring-1 ring-border/80 group-hover:scale-125",
                        )}
                      />
                    </div>
                  );
                })}
              </div>

              {/* X-Axis Date Ticks with selected day highlighted */}
              <div className="flex items-center justify-between px-1 pt-1">
                {sleepData.map((pt) => {
                  const isSelected = pt.iso === selectedSleepDate;
                  return (
                    <button
                      key={pt.iso}
                      type="button"
                      onClick={() => setSelectedSleepDate(pt.iso)}
                      className="flex flex-col items-center py-0.5 transition-all group flex-1"
                    >
                      <span
                        className={cn(
                          "text-[10px] transition-colors",
                          isSelected
                            ? "font-extrabold text-cyan-400"
                            : "font-semibold text-faint group-hover:text-text",
                        )}
                      >
                        {pt.iso.slice(5)}
                      </span>
                      {/* Highlight underline */}
                      <div
                        className={cn(
                          "mt-0.5 h-0.5 w-full max-w-[24px] rounded-full transition-all",
                          isSelected ? "bg-cyan-400" : "bg-transparent group-hover:bg-border/60",
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        {/* ================= CARD 2: EXERCISE WEIGHT PROGRESSION (CLEAN LINE GRAPH) ================= */}
        <Card className="p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header, Exercise Selector & Metric Toggle */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent">
                    <Dumbbell className="h-4 w-4" />
                  </div>
                  <div>
                    <SectionTitle>Exercise Weight & Progression</SectionTitle>
                    <p className="text-[11px] text-faint">Track strength curves across workouts</p>
                  </div>
                </div>

                {/* Metric Selector (Max Weight / 1RM / Volume) */}
                <div className="flex items-center rounded-lg bg-surface-2 p-0.5 border border-border/60">
                  <button
                    onClick={() => setExerciseMetric("maxWeight")}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-bold transition",
                      exerciseMetric === "maxWeight"
                        ? "bg-accent text-accent-fg shadow-sm"
                        : "text-muted hover:text-text",
                    )}
                    title="Max Weight Lifted in Session"
                  >
                    Weight
                  </button>
                  <button
                    onClick={() => setExerciseMetric("e1rm")}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-bold transition",
                      exerciseMetric === "e1rm"
                        ? "bg-accent text-accent-fg shadow-sm"
                        : "text-muted hover:text-text",
                    )}
                    title="Estimated 1 Rep Max"
                  >
                    Est. 1RM
                  </button>
                  <button
                    onClick={() => setExerciseMetric("volume")}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-bold transition",
                      exerciseMetric === "volume"
                        ? "bg-accent text-accent-fg shadow-sm"
                        : "text-muted hover:text-text",
                    )}
                    title="Total Volume (Weight × Reps)"
                  >
                    Volume
                  </button>
                </div>
              </div>

              {/* Exercise Selector Dropdown */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedEx}
                  onChange={(e) => setSelectedEx(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs font-bold text-text focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <optgroup label="Logged Exercises">
                    {availableExercises
                      .filter((e) => e.loggedSessionsCount > 0)
                      .map((ex) => (
                        <option key={ex.name} value={ex.name}>
                          {ex.name} ({ex.loggedSessionsCount} session{ex.loggedSessionsCount > 1 ? "s" : ""}) · Max {ex.maxWeight}kg
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Exercise Library">
                    {availableExercises
                      .filter((e) => e.loggedSessionsCount === 0)
                      .map((ex) => (
                        <option key={ex.name} value={ex.name}>
                          {ex.name} ({ex.category})
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Selected Exercise Quick PR Strip */}
            <div className="grid grid-cols-4 gap-2 rounded-xl border border-border/60 bg-surface-2/60 p-2.5 text-center">
              <div>
                <span className="text-[10px] uppercase font-semibold text-faint">PR Weight</span>
                <div className="text-sm font-bold text-accent">
                  {currentExStats?.maxWeight ? `${currentExStats.maxWeight} kg` : "—"}
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-faint">Est 1RM</span>
                <div className="text-sm font-bold text-warn">
                  {currentExStats?.max1RM ? `${currentExStats.max1RM} kg` : "—"}
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-faint">Sessions</span>
                <div className="text-sm font-bold text-text">
                  {progressionData.length}
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-faint">Improvement</span>
                <div className={cn("text-sm font-bold", improvementPct && improvementPct > 0 ? "text-emerald-400" : "text-muted")}>
                  {improvementPct !== null ? `${improvementPct > 0 ? "+" : ""}${improvementPct}%` : "—"}
                </div>
              </div>
            </div>

            {/* Exercise Progression Clean Line Chart */}
            {progressionData.length > 0 ? (
              <div className="space-y-2">
                <div className="relative h-48 w-full rounded-xl bg-surface-2/30 p-2 border border-border/40 overflow-hidden">
                  {/* SVG Curves */}
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="absolute inset-0 h-full w-full pointer-events-none"
                  >
                    <defs>
                      <linearGradient id={gradIdEx} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Gradient Area */}
                    {exAreaPath && <path d={exAreaPath} fill={`url(#${gradIdEx})`} />}

                    {/* Main Line Stroke */}
                    {exLinePath && (
                      <path
                        d={exLinePath}
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                  </svg>

                  {/* HTML Value Labels & Interactive Points */}
                  {exCoords.map((coord, idx) => {
                    const isPR = coord.data.hasPR;

                    return (
                      <div
                        key={idx}
                        style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 group z-20"
                      >
                        {/* Clean Value Badge above dot */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded-md bg-surface-1/90 border border-border/80 px-1.5 py-0.2 text-[10px] font-extrabold text-text shadow-sm">
                          {coord.val}{exerciseMetric !== "volume" ? "kg" : ""}
                        </div>

                        {/* Tooltip on Hover */}
                        <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover:flex flex-col items-center whitespace-nowrap rounded-lg bg-surface-3 px-2.5 py-1.5 text-[11px] font-bold text-text shadow-2xl border border-border z-30">
                          <span>
                            {coord.data.iso}: {coord.val} {getMetricUnit()}
                          </span>
                          <span className="text-[10px] text-muted font-normal mt-0.5">
                            {coord.data.sets.map((s) => formatSetSummary(s, coord.data.trackingMode, selectedEx)).join(" · ")}
                          </span>
                          {isPR && (
                            <span className="mt-0.5 text-[9px] font-bold text-warn">⭐ Personal Record!</span>
                          )}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-surface-3" />
                        </div>

                        {/* Round Crisp Point */}
                        <div
                          className={cn(
                            "rounded-full transition-all flex items-center justify-center cursor-pointer",
                            isPR
                              ? "h-3.5 w-3.5 bg-warn ring-4 ring-warn/30 shadow-md animate-pulse"
                              : "h-3 w-3 bg-accent ring-2 ring-surface-1 group-hover:scale-125 group-hover:bg-accent",
                          )}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Session Date & Sets Breakdown under chart */}
                <div className="flex items-center justify-between px-2 pt-1 border-t border-border/50 text-[10px] font-semibold">
                  {progressionData.map((pt, i) => (
                    <div key={i} className="flex flex-col items-center text-center">
                      <span className="text-text font-bold">{pt.iso.slice(5)}</span>
                      <span className="text-[9px] text-faint max-w-[90px] truncate">
                        {pt.sets.map((s) => formatSetSummary(s, pt.trackingMode, selectedEx)).join(", ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-14 text-center space-y-2">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-faint">
                  <Dumbbell className="h-5 w-5" />
                </div>
                <p className="text-xs text-muted font-medium">
                  No completed sessions logged for <span className="text-text font-bold">{selectedEx}</span> yet.
                </p>
                <p className="text-[11px] text-faint">
                  Start or log a workout with this exercise to automatically chart your strength curve!
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ================= LOWER SECTION: BODYWEIGHT TREND & PR HALL OF FAME ================= */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ================= BODYWEIGHT TREND CARD ================= */}
        <Card className="p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Header & Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <Scale className="h-4 w-4" />
                </div>
                <div>
                  <SectionTitle>Bodyweight Records & Trends</SectionTitle>
                  <p className="text-[11px] text-faint">
                    {currentWeight ? `Latest: ${currentWeight} kg` : "Daily scale entries & weight curve"}
                    {avgWeight !== null && <span className="ml-2 font-medium text-faint">· Avg: {avgWeight} kg</span>}
                    {weightDiff !== null && (
                      <span className={cn("ml-2 font-bold", weightDiff <= 0 ? "text-emerald-400" : "text-amber-400")}>
                        ({weightDiff > 0 ? `+${weightDiff}` : weightDiff} kg)
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex items-center rounded-lg bg-surface-2 p-0.5 border border-border/60">
                  {(
                    [
                      { tf: 7, label: "7D" },
                      { tf: 14, label: "14D" },
                      { tf: 30, label: "30D" },
                      { tf: 90, label: "90D" },
                      { tf: "all", label: "All" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.label}
                      onClick={() => setWeightTimeframe(item.tf)}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[11px] font-bold transition",
                        weightTimeframe === item.tf
                          ? "bg-accent text-accent-fg shadow-sm"
                          : "text-muted hover:text-text",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => openWeightModalForDate(selectedWeightDate)}
                  className="flex items-center gap-1 rounded-lg bg-accent/15 px-2.5 py-1 text-[11px] font-bold text-accent hover:bg-accent hover:text-accent-fg transition"
                >
                  <Plus className="h-3 w-3" /> Log Weight
                </button>
              </div>
            </div>

            {/* Quick Weight Metrics Strip */}
            {activeWeights.length > 0 && (
              <div className="grid grid-cols-4 gap-2 rounded-xl border border-border/60 bg-surface-2/60 p-2.5 text-center">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-faint">Current</span>
                  <div className="text-sm font-bold text-accent">
                    {currentWeight ? `${currentWeight} kg` : "—"}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-faint">Period Min</span>
                  <div className="text-sm font-bold text-text">
                    {minWeight ? `${minWeight} kg` : "—"}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-faint">Period Max</span>
                  <div className="text-sm font-bold text-text">
                    {maxWeight ? `${maxWeight} kg` : "—"}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-faint">Net Change</span>
                  <div
                    className={cn(
                      "text-sm font-bold",
                      weightDiff === null ? "text-muted" : weightDiff <= 0 ? "text-emerald-400" : "text-amber-400",
                    )}
                  >
                    {weightDiff !== null ? `${weightDiff > 0 ? "+" : ""}${weightDiff} kg` : "—"}
                  </div>
                </div>
              </div>
            )}

            {/* Smooth SVG Curve Weight Chart */}
            {activeWeights.length > 0 ? (
              <div className="space-y-2">
                <div className="relative h-48 w-full rounded-xl bg-surface-2/30 p-2 border border-border/40 overflow-hidden">
                  {/* SVG Curves */}
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="absolute inset-0 h-full w-full pointer-events-none"
                  >
                    <defs>
                      <linearGradient id={gradIdWeight} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Gradient Area */}
                    {weightAreaPath && <path d={weightAreaPath} fill={`url(#${gradIdWeight})`} />}

                    {/* Main Line Stroke */}
                    {weightLinePath && (
                      <path
                        d={weightLinePath}
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                  </svg>

                  {/* HTML Value Labels & Interactive Points */}
                  {weightCoords.map((coord) => {
                    const isSelected = coord.pt.iso === selectedWeightDate;
                    const diffText =
                      coord.pt.diff !== undefined
                        ? coord.pt.diff > 0
                          ? `+${coord.pt.diff} kg`
                          : `${coord.pt.diff} kg`
                        : null;

                    return (
                      <div
                        key={coord.pt.iso}
                        style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
                        onClick={() => {
                          setSelectedWeightDate(coord.pt.iso);
                          openWeightModalForDate(coord.pt.iso);
                        }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                      >
                        {/* Value Badge above dot */}
                        <div
                          className={cn(
                            "absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded-md px-1.5 py-0.2 text-[10px] font-extrabold shadow-sm transition-all",
                            isSelected
                              ? "bg-accent text-accent-fg border border-accent"
                              : "bg-surface-1/90 border border-border/80 text-text",
                          )}
                        >
                          {coord.pt.value}kg
                        </div>

                        {/* Tooltip on Hover */}
                        <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover:flex flex-col items-center whitespace-nowrap rounded-lg bg-surface-3 px-2.5 py-1.5 text-[11px] font-bold text-text shadow-2xl border border-border z-30">
                          <span>
                            {relLabel(coord.pt.iso)}: <span className="text-accent">{coord.pt.value} kg</span>
                          </span>
                          {diffText && (
                            <span
                              className={cn(
                                "text-[10px] font-normal mt-0.5",
                                coord.pt.diff! <= 0 ? "text-emerald-400" : "text-amber-400",
                              )}
                            >
                              {diffText} vs previous
                            </span>
                          )}
                          <span className="text-[9px] text-faint font-normal mt-0.5">Click to edit</span>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-surface-3" />
                        </div>

                        {/* Round Crisp Point */}
                        <div
                          className={cn(
                            "rounded-full transition-all flex items-center justify-center",
                            isSelected
                              ? "h-4 w-4 bg-emerald-400 ring-4 ring-emerald-400/30 shadow-lg"
                              : "h-3 w-3 bg-accent ring-2 ring-surface-1 group-hover:scale-125 group-hover:bg-emerald-300",
                          )}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* X-Axis Date Labels with Click to Select / Edit */}
                <div className="flex items-center justify-between px-1 pt-1">
                  {activeWeights.map((pt) => {
                    const isSelected = pt.iso === selectedWeightDate;
                    return (
                      <button
                        key={pt.iso}
                        type="button"
                        onClick={() => {
                          setSelectedWeightDate(pt.iso);
                          openWeightModalForDate(pt.iso);
                        }}
                        className="flex flex-col items-center py-0.5 transition-all group flex-1"
                      >
                        <span
                          className={cn(
                            "text-[10px] transition-colors",
                            isSelected
                              ? "font-extrabold text-emerald-400"
                              : "font-semibold text-faint group-hover:text-text",
                          )}
                        >
                          {pt.iso.slice(5)}
                        </span>
                        {/* Highlight underline */}
                        <div
                          className={cn(
                            "mt-0.5 h-0.5 w-full max-w-[24px] rounded-full transition-all",
                            isSelected ? "bg-emerald-400" : "bg-transparent group-hover:bg-border/60",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-14 text-center space-y-3">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-faint">
                  <Scale className="h-5 w-5 text-accent" />
                </div>
                <p className="text-xs text-muted font-medium">No bodyweight records logged yet.</p>
                <button
                  onClick={() => openWeightModalForDate(todayISO())}
                  className="btn-hero inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold"
                >
                  <Plus className="h-3.5 w-3.5" /> Log Your First Weigh-In
                </button>
              </div>
            )}
          </div>
        </Card>

        {/* PR Hall of Fame */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <SectionTitle>Personal Records (PR) Hall of Fame</SectionTitle>
              <p className="text-[11px] text-faint">All-time exercise maximums</p>
            </div>
            <Sparkles className="h-4 w-4 text-warn" />
          </div>

          {Object.keys(prs).length === 0 ? (
            <div className="py-10 text-center text-xs text-faint">
              No PRs recorded yet. Complete workout sessions to automatically unlock PR badges!
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 max-h-52 overflow-y-auto pr-1">
              {Object.entries(prs).map(([name, data]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-xl border border-border/80 bg-surface-1 p-3"
                >
                  <div className="truncate pr-2">
                    <h4 className="font-bold text-xs text-text truncate">{name}</h4>
                    <div className="mt-1 flex items-center gap-2 text-[11px]">
                      <span className="font-bold text-accent">{data.maxWeight} kg</span>
                      <span className="text-faint">1RM: {data.max1RM} kg</span>
                    </div>
                  </div>
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-warn/15 text-warn shrink-0">
                    <Trophy className="h-3.5 w-3.5" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Sleep Logger Modal for Date Editing */}
      <SleepLoggerModal
        open={isSleepModalOpen}
        initialDate={modalDate}
        onClose={() => setIsSleepModalOpen(false)}
      />

      {/* Weight Logger Modal for Date Editing */}
      <WeightLoggerModal
        open={isWeightModalOpen}
        initialDate={weightModalDate}
        onClose={() => setIsWeightModalOpen(false)}
      />
    </div>
  );
}
