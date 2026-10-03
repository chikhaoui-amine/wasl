"use client";

import { useState } from "react";
import { Modal, Field, inputCls } from "@/components/ui/Modal";
import type { StudyModule } from "@/lib/data/domains/studies";

interface ModuleFormModalProps {
  open: boolean;
  onClose: () => void;
  initialModule?: StudyModule | null;
  currentLevel: string;
  currentSemester: string;
  onSave: (data: {
    id?: string;
    code: string;
    name: string;
    level: string;
    semester: string;
    coefficient: number;
    color: string;
    icon: string;
    absenceLimits: { td: number; tp: number; cours: number };
  }) => Promise<void>;
}

const PRESET_COLORS = [
  "#38bdf8", // Sky
  "#0284c7", // Blue
  "#14b8a6", // Teal
  "#10b981", // Emerald
  "#eab308", // Yellow
  "#f97316", // Orange
  "#f43f5e", // Rose
  "#8b5cf6", // Purple
  "#6366f1", // Indigo
  "#64748b", // Slate
];

const PRESET_ICONS = [
  "BookOpen",
  "FolderTree",
  "Cpu",
  "Calculator",
  "Sigma",
  "Terminal",
  "Code2",
  "Share2",
  "Binary",
  "Network",
  "Database",
  "Layers",
  "Zap",
  "Languages",
];

export function ModuleFormModal({
  open,
  onClose,
  initialModule,
  currentLevel,
  currentSemester,
  onSave,
}: ModuleFormModalProps) {
  const [code, setCode] = useState(initialModule?.code || "");
  const [name, setName] = useState(initialModule?.name || "");
  const [coefficient, setCoefficient] = useState(initialModule?.coefficient ?? 3);
  const [color, setColor] = useState(initialModule?.color || PRESET_COLORS[0]);
  const icon = initialModule?.icon || PRESET_ICONS[0];
  const [limitTd, setLimitTd] = useState(initialModule?.absenceLimits.td ?? 3);
  const [limitTp, setLimitTp] = useState(initialModule?.absenceLimits.tp ?? 3);
  const [limitCours, setLimitCours] = useState(initialModule?.absenceLimits.cours ?? 5);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: initialModule?.id,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        level: initialModule?.level || currentLevel,
        semester: initialModule?.semester || currentSemester,
        coefficient: Number(coefficient) >= 0 ? Number(coefficient) : 1,
        color,
        icon,
        absenceLimits: {
          td: Number(limitTd) >= 1 ? Number(limitTd) : 3,
          tp: Number(limitTp) >= 1 ? Number(limitTp) : 3,
          cours: Number(limitCours) >= 1 ? Number(limitCours) : 5,
        },
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialModule ? `Edit Module ${initialModule.code}` : "Add Study Module"}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <Field label="Code">
              <input
                type="text"
                placeholder="SFSD"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className={inputCls}
                required
                autoFocus
              />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Module Name">
              <input
                type="text"
                placeholder="Structures de Fichiers & Données"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                required
              />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Field label="Coeff">
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={coefficient}
              onChange={(e) => setCoefficient(Number(e.target.value))}
              className={inputCls}
              required
            />
          </Field>
          <Field label="TD Limit">
            <input
              type="number"
              min="1"
              value={limitTd}
              onChange={(e) => setLimitTd(Number(e.target.value))}
              className={inputCls}
              title="Exclusion threshold for TD"
              required
            />
          </Field>
          <Field label="TP Limit">
            <input
              type="number"
              min="1"
              value={limitTp}
              onChange={(e) => setLimitTp(Number(e.target.value))}
              className={inputCls}
              title="Exclusion threshold for TP"
              required
            />
          </Field>
          <Field label="Cours Limit">
            <input
              type="number"
              min="1"
              value={limitCours}
              onChange={(e) => setLimitCours(Number(e.target.value))}
              className={inputCls}
              title="Exclusion threshold for Cours"
              required
            />
          </Field>
        </div>

        <Field label="Accent Color">
          <div className="flex flex-wrap gap-2 pt-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full border-2 transition-transform ${
                  color === c ? "scale-110 border-text shadow-sm" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </Field>

        <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-text transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-accent-fg shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Saving…" : initialModule ? "Save Changes" : "Create Module"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
