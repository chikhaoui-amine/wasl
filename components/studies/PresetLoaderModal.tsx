"use client";

import { useState } from "react";
import { Modal, Field } from "@/components/ui/Modal";
import {
  ESI_CURRICULUM_PRESETS,
  type PresetCurriculum,
} from "@/lib/data/domains/studies";
import { Sparkles, Check, AlertCircle } from "lucide-react";

interface PresetLoaderModalProps {
  open: boolean;
  onClose: () => void;
  currentLevel: string;
  currentSemester: string;
  onLoad: (level: string, semester: string, mode: "replace" | "merge") => Promise<void>;
}

export function PresetLoaderModal({
  open,
  onClose,
  currentLevel,
  currentSemester,
  onLoad,
}: PresetLoaderModalProps) {
  const [selectedKey, setSelectedKey] = useState<string>(
    `${currentLevel || "2CPI"}-${currentSemester || "S1"}`,
  );
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [loading, setLoading] = useState(false);

  const selectedPreset: PresetCurriculum | undefined = ESI_CURRICULUM_PRESETS.find(
    (p) => `${p.level}-${p.semester}` === selectedKey,
  ) || ESI_CURRICULUM_PRESETS[0];

  const handleApply = async () => {
    if (!selectedPreset) return;
    setLoading(true);
    try {
      await onLoad(selectedPreset.level, selectedPreset.semester, mode);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Load Official ESI Curriculum Preset" wide>
      <div className="space-y-4 pt-1">
        <p className="text-xs text-muted leading-relaxed">
          Instantly load official <strong>ESI Algiers</strong> curricula pre-configured with course modules, exact coefficients, default chapters, TD series, and links to <strong>Tresor ESI</strong>.
        </p>

        <Field label="Choose Curriculum">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ESI_CURRICULUM_PRESETS.map((preset) => {
              const key = `${preset.level}-${preset.semester}`;
              const active = key === selectedKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                    active
                      ? "border-accent bg-accent/10 text-text shadow-sm"
                      : "border-border/70 bg-surface hover:bg-surface-2 text-muted"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-xs text-text">{preset.label}</span>
                    {active && <Check className="h-4 w-4 text-accent" />}
                  </div>
                  <span className="text-[11px] text-faint mt-1">
                    {preset.modules.length} modules · {preset.modules.map((m) => m.code).join(", ")}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>

        {selectedPreset && (
          <div className="rounded-xl border border-border/70 bg-surface-2/30 p-3.5 space-y-2.5">
            <h4 className="text-xs font-bold text-text uppercase tracking-wider">
              Preview Modules ({selectedPreset.modules.length})
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {selectedPreset.modules.map((m) => (
                <span
                  key={m.code}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold bg-surface border border-border/70 text-text"
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                  {m.code}
                  <span className="text-[10px] text-faint font-normal">Coeff {m.coefficient}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <Field label="Import Mode">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("merge")}
              className={`flex flex-col p-3 rounded-xl border text-left transition-all ${
                mode === "merge"
                  ? "border-accent bg-accent/10 shadow-sm"
                  : "border-border/70 bg-surface hover:bg-surface-2 text-muted"
              }`}
            >
              <span className="text-xs font-bold text-text">Merge (Recommended)</span>
              <span className="text-[10px] text-faint mt-0.5">
                Keeps your existing custom modules & data; adds missing curriculum modules.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode("replace")}
              className={`flex flex-col p-3 rounded-xl border text-left transition-all ${
                mode === "replace"
                  ? "border-danger bg-danger/10 shadow-sm"
                  : "border-border/70 bg-surface hover:bg-surface-2 text-muted"
              }`}
            >
              <span className="text-xs font-bold text-danger flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> Replace Semester
              </span>
              <span className="text-[10px] text-faint mt-0.5">
                Replaces current semester modules with the official preset fresh baseline.
              </span>
            </button>
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
            type="button"
            onClick={handleApply}
            disabled={loading || !selectedPreset}
            className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-accent-fg shadow-sm hover:opacity-90 transition-opacity flex items-center gap-1.5 disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {loading ? "Loading Preset…" : "Apply Preset"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
