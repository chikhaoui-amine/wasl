"use client";

import { useState } from "react";
import { Modal, Field, inputCls } from "@/components/ui/Modal";
import type { StudyModule, SessionType } from "@/lib/data/domains/studies";
import { todayISO } from "@/lib/date";

interface AbsenceLogModalProps {
  open: boolean;
  onClose: () => void;
  modules: StudyModule[];
  defaultModuleId?: string;
  onLog: (input: {
    moduleId: string;
    type: SessionType;
    date: string;
    justified: boolean;
    note?: string;
  }) => Promise<void>;
}

export function AbsenceLogModal({
  open,
  onClose,
  modules,
  defaultModuleId,
  onLog,
}: AbsenceLogModalProps) {
  const [moduleId, setModuleId] = useState(defaultModuleId || modules[0]?.id || "");
  const [type, setType] = useState<SessionType>("td");
  const [date, setDate] = useState(todayISO());
  const [justified, setJustified] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Sync defaultModuleId when opened
  const currentModuleId = moduleId || defaultModuleId || modules[0]?.id || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentModuleId) return;
    setSaving(true);
    try {
      await onLog({
        moduleId: currentModuleId,
        type,
        date,
        justified,
        note: note.trim() || undefined,
      });
      setNote("");
      setJustified(false);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Log an Absence">
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <Field label="Module">
          <select
            value={currentModuleId}
            onChange={(e) => setModuleId(e.target.value)}
            className={inputCls}
            required
          >
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} — {m.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Session Type">
          <div className="grid grid-cols-3 gap-2">
            {(["td", "tp", "cours"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-xl border py-2 text-xs font-bold uppercase transition-all ${
                  type === t
                    ? "border-accent bg-accent/15 text-accent shadow-sm"
                    : "border-border/70 bg-surface hover:bg-surface-2 text-muted"
                }`}
              >
                {t === "td" ? "TD (Tutorial)" : t === "tp" ? "TP (Lab)" : "Cours (Lecture)"}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Date of Absence">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
            required
          />
        </Field>

        <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-surface-2/40 p-3">
          <input
            id="justified-checkbox"
            type="checkbox"
            checked={justified}
            onChange={(e) => setJustified(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-accent"
          />
          <label htmlFor="justified-checkbox" className="text-xs text-text select-none cursor-pointer">
            <span className="font-semibold">Justified absence</span>
            <span className="block text-[11px] text-faint">
              Medical certificate or official dispensation (exempt from the 3-absence exclusion penalty).
            </span>
          </label>
        </div>

        <Field label="Note / Justification reference (optional)">
          <input
            type="text"
            placeholder="e.g. Certificat médical déposé à l'administration"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputCls}
          />
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
            disabled={saving || !currentModuleId}
            className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-accent-fg shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Saving…" : "Log Absence"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
