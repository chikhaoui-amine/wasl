"use client";

import { useState } from "react";
import { Modal, Field, FormFooter, inputCls } from "@/components/ui/Modal";
import {
  useGoalsData,
  monthBounds,
  quarterBounds,
  yearBounds,
  NORTH_STAR_PRESETS,
  type Goal,
  type GoalType,
  type GoalStatus,
  type Milestone,
} from "@/lib/data/domains/goals";
import { Target, Compass, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { MilestoneList } from "@/components/details/parts";

const TYPE_OPTIONS: { id: GoalType; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "north_star", label: "North Star (Lifetime)", desc: "Permanent lifetime direction without deadline", icon: Compass },
  { id: "yearly_outcome", label: "Goal / Outcome", desc: "Measurable outcome with target dates & milestones", icon: Target },
  { id: "challenge", label: "Challenge / Sprint", desc: "Short time-bound sprint or push", icon: Zap },
];

const NORTH_STAR_COLORS = [
  "#7c9cf5",
  "#5fb36a",
  "#37c9b7",
  "#d95f6a",
  "#e0a34a",
  "#b57edc",
  "#f472b6",
  "#9aa0aa",
];

type PresetPeriod = "month" | "quarter" | "year" | "custom";

const PRESETS: { id: PresetPeriod; label: string }[] = [
  { id: "month", label: "This month" },
  { id: "quarter", label: "This quarter" },
  { id: "year", label: "This year" },
  { id: "custom", label: "Custom" },
];

export function GoalForm(props: {
  open: boolean;
  onClose: () => void;
  goal?: Goal;
  initialPeriod?: { start: string; end: string };
  initialType?: GoalType;
  initialNorthStarId?: string;
  defaultTargetYear?: number;
}) {
  if (!props.open) return null;
  return <GoalFormInner key={props.goal?.id ?? "new"} {...props} />;
}

function GoalFormInner({
  open,
  onClose,
  goal,
  initialPeriod,
  initialType,
  initialNorthStarId,
  defaultTargetYear,
}: {
  open: boolean;
  onClose: () => void;
  goal?: Goal;
  initialPeriod?: { start: string; end: string };
  initialType?: GoalType;
  initialNorthStarId?: string;
  defaultTargetYear?: number;
}) {
  const { addGoal, updateGoal, deleteGoal, goals } = useGoalsData();

  const userNorthStars = goals.filter((g) => g.type === "north_star");
  let hiddenNorthStars: string[] = [];
  try {
    const stored = typeof window !== "undefined" ? localStorage.getItem("wasl_hidden_north_stars") : null;
    if (stored) hiddenNorthStars = JSON.parse(stored);
  } catch {
    // ignore
  }

  const availableNorthStars = [
    ...userNorthStars.map((g) => ({
      id: g.id,
      title: g.title,
      color: g.customCategoryColor || "#b57edc",
    })),
    ...NORTH_STAR_PRESETS.filter(
      (p) =>
        !hiddenNorthStars.includes(p.id) &&
        !userNorthStars.some((u) => u.id === p.id || u.title.toLowerCase() === p.title.toLowerCase()),
    ).map((p) => ({
      id: p.id,
      title: p.title,
      color: p.color,
    })),
  ];

  const defaultNorthStar =
    goal?.northStarId ??
    initialNorthStarId ??
    goal?.category ??
    (availableNorthStars[0]?.id || "personal_growth");

  const [type, setType] = useState<GoalType>(initialType ?? goal?.type ?? "yearly_outcome");
  const [title, setTitle] = useState(goal?.title ?? "");
  const [why, setWhy] = useState(goal?.why ?? "");
  const [northStarId, setNorthStarId] = useState(defaultNorthStar);
  const [status, setStatus] = useState<GoalStatus>(goal?.status ?? (goal?.completed ? "completed" : "active"));
  const [isCurrentFocus] = useState(goal?.isCurrentFocus ?? false);
  const [linkedOutcomeId, setLinkedOutcomeId] = useState(goal?.linkedOutcomeId ?? "");

  const [customCategoryColor, setCustomCategoryColor] = useState(goal?.customCategoryColor ?? "#b57edc");
  const [targetYear] = useState<number>(
    goal?.targetYear ??
      defaultTargetYear ??
      (goal?.end ? new Date(goal.end).getFullYear() : new Date().getFullYear()),
  );

  const initialPresetAndDates = (): { preset: PresetPeriod; start: string; end: string } => {
    if (goal?.start && goal?.end) {
      return { preset: "custom", start: goal.start, end: goal.end };
    } else if (!goal && initialPeriod) {
      return { preset: "custom", start: initialPeriod.start, end: initialPeriod.end };
    } else {
      const q = quarterBounds();
      return { preset: "quarter", start: q.start, end: q.end };
    }
  };

  const initialDates = initialPresetAndDates();
  const [preset, setPreset] = useState<PresetPeriod>(initialDates.preset);
  const [start, setStart] = useState(initialDates.start);
  const [end, setEnd] = useState(initialDates.end);
  const [manualProgress] = useState(goal?.manualProgress ?? 0);
  const [milestones, setMilestones] = useState<Milestone[]>(goal?.milestones ? [...goal.milestones] : []);

  const pickPreset = (p: PresetPeriod) => {
    setPreset(p);
    const b = p === "month" ? monthBounds() : p === "quarter" ? quarterBounds() : p === "year" ? yearBounds() : null;
    if (b) {
      setStart(b.start);
      setEnd(b.end);
    }
  };

  const valid = title.trim().length > 0 && (type === "north_star" || !start || !end || end >= start);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;

    const input = {
      title: title.trim(),
      why: why.trim() || undefined,
      start: type === "north_star" ? undefined : start || undefined,
      end: type === "north_star" ? undefined : end || undefined,
      targetYear:
        type === "yearly_outcome"
          ? (end ? new Date(end).getFullYear() : (defaultTargetYear ?? targetYear))
          : undefined,
      manualProgress: type === "north_star" ? 0 : manualProgress,
      category: type === "north_star" ? "north_star" : northStarId,
      customCategoryColor: type === "north_star" ? customCategoryColor : undefined,
      type,
      status: type === "north_star" ? ("active" as GoalStatus) : status,
      northStarId: type === "north_star" ? undefined : northStarId,
      isCurrentFocus: type === "yearly_outcome" ? isCurrentFocus : false,
      linkedOutcomeId: linkedOutcomeId || undefined,
      milestones: type === "north_star" ? [] : milestones,
    };

    if (goal) updateGoal(goal.id, input);
    else addGoal(input);

    onClose();
  };

  const yearlyOutcomes = goals.filter((g) => g.type === "yearly_outcome" || (!g.type && !g.completed));

  const isDirty = Boolean(
    title.trim() !== (goal?.title ?? "") ||
    why.trim() !== (goal?.why ?? "") ||
    milestones.length !== (goal?.milestones?.length ?? 0)
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="3xl"
      title={goal ? "Edit Goal" : "Create Goal or Outcome"}
      preventBackdropClose={true}
      dirty={isDirty}
      confirmDiscardMessage="You have unsaved changes in this goal/outcome. Discard edits?"
    >
      <form onSubmit={submit} className="space-y-4">
        {/* Step 1: Type Selector */}
        {!goal && (
          <Field label="What type of item are you creating?">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setType(opt.id)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all",
                      type === opt.id
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border bg-surface-2 text-muted hover:text-text",
                    )}
                  >
                    <div className="flex items-center gap-2 font-semibold text-[13px]">
                      <Icon className="h-4 w-4" /> {opt.label}
                    </div>
                    <span className="text-[11px] text-faint line-clamp-2 leading-tight">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {/* Title */}
        <Field label={type === "north_star" ? "North Star Title (Lifetime Direction)" : "Goal Title / Outcome"}>
          <input
            autoFocus
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              type === "north_star"
                ? "e.g. AI & Tech Sovereignty"
                : "e.g. Reach $10k MRR & 50 Paying Clients"
            }
          />
        </Field>

        {/* Description / Vision */}
        <Field label={type === "north_star" ? "One-line Vision / Purpose" : "Why it matters / Summary"}>
          <textarea
            rows={2}
            className={`${inputCls} resize-none`}
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            placeholder={type === "north_star" ? "The core vision driving this lifetime direction" : "The core reason driving this goal"}
          />
        </Field>

        {/* Color picker for North Star */}
        {type === "north_star" && (
          <Field label="Accent Color">
            <div className="flex flex-wrap gap-2 pt-1">
              {NORTH_STAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCustomCategoryColor(c)}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                    customCategoryColor === c ? "border-text scale-110 shadow-sm" : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </Field>
        )}

        {/* Linked North Star for Yearly Outcomes & Projects */}
        {type !== "north_star" && (
          <Field label="Linked North Star (Direction)">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {availableNorthStars.map((ns) => (
                <button
                  key={ns.id}
                  type="button"
                  onClick={() => setNorthStarId(ns.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border p-2.5 text-[12px] font-medium transition-all text-left",
                    northStarId === ns.id
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border bg-surface-2 text-muted hover:text-text",
                  )}
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: ns.color }} />
                  <span className="leading-tight">{ns.title}</span>
                </button>
              ))}
            </div>
          </Field>
        )}

        {/* Project Link to Yearly Outcome */}
        {type === "challenge" && yearlyOutcomes.length > 0 && (
          <Field label="Link to Yearly Outcome (Optional)">
            <select
              value={linkedOutcomeId}
              onChange={(e) => setLinkedOutcomeId(e.target.value)}
              className={inputCls}
            >
              <option value="">-- None --</option>
              {yearlyOutcomes.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </Field>
        )}

        {/* Target Timeline for dated items */}
        {type !== "north_star" && (
          <Field
            label={
              <div className="flex items-center justify-between">
                <span>Target Timeline</span>
                {start && end && new Date(start).getFullYear() !== new Date(end).getFullYear() && (
                  <span className="rounded-pill bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">
                    Span: {String(new Date(start).getFullYear()).slice(-2)}/{String(new Date(end).getFullYear()).slice(-2)}
                  </span>
                )}
              </div>
            }
          >
            <div className="mb-2 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickPreset(p.id)}
                  className={cn(
                    "rounded-pill px-3 py-1 text-[12px] font-medium transition-colors",
                    preset === p.id ? "bg-accent-soft text-accent" : "bg-surface-2 text-faint hover:text-muted",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                className={inputCls}
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  setPreset("custom");
                }}
              />
              <input
                type="date"
                className={inputCls}
                value={end}
                onChange={(e) => {
                  setEnd(e.target.value);
                  setPreset("custom");
                }}
              />
            </div>
          </Field>
        )}

        {/* Milestones / Steps */}
        {type !== "north_star" && (
          <Field label={`Milestones / Steps (${milestones.length})`}>
            <MilestoneList
              milestones={milestones}
              onAdd={(mTitle) =>
                setMilestones((prev) => [
                  ...prev,
                  { id: crypto.randomUUID(), title: mTitle, done: false },
                ])
              }
              onToggle={(mId) =>
                setMilestones((prev) =>
                  prev.map((m) => (m.id === mId ? { ...m, done: !m.done } : m)),
                )
              }
              onDelete={(mId) =>
                setMilestones((prev) => prev.filter((m) => m.id !== mId))
              }
              onUpdate={(mId, mTitle) =>
                setMilestones((prev) =>
                  prev.map((m) => (m.id === mId ? { ...m, title: mTitle } : m)),
                )
              }
              onMove={(mId, dir) =>
                setMilestones((prev) => {
                  const ms = [...prev];
                  const idx = ms.findIndex((m) => m.id === mId);
                  if (idx === -1) return prev;
                  const targetIdx = dir === "up" ? idx - 1 : idx + 1;
                  if (targetIdx < 0 || targetIdx >= ms.length) return prev;
                  const [item] = ms.splice(idx, 1);
                  ms.splice(targetIdx, 0, item);
                  return ms;
                })
              }
            />
          </Field>
        )}

        {/* Status selector */}
        {type !== "north_star" && (
          <Field label="Status">
            <div className="grid grid-cols-4 gap-1.5">
              {(["active", "paused", "completed", "later"] as GoalStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatus(st)}
                  className={cn(
                    "rounded-xl border p-2 text-center text-[12px] font-semibold capitalize transition-all",
                    status === st
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border bg-surface-2 text-muted hover:text-text",
                  )}
                >
                  {st}
                </button>
              ))}
            </div>
          </Field>
        )}

        <FormFooter
          submitLabel={goal ? "Save Changes" : `Create ${TYPE_OPTIONS.find((t) => t.id === type)?.label}`}
          disabled={!valid}
          onDelete={
            goal
              ? async () => {
                  try {
                    await deleteGoal(goal.id);
                    onClose();
                  } catch (err) {
                    console.error("Failed to delete goal:", err);
                  }
                }
              : undefined
          }
        />
      </form>
    </Modal>
  );
}
