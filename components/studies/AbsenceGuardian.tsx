"use client";

import { useState } from "react";
import {
  type StudyModule,
  type StudyAbsenceRecord,
  calculateModuleAbsenceStats,
} from "@/lib/data/domains/studies";
import { AlertTriangle, ShieldCheck, ShieldAlert, History, Trash2, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface AbsenceGuardianProps {
  modules: StudyModule[];
  absences: StudyAbsenceRecord[];
  onQuickLog: (moduleId: string) => void;
  onDeleteAbsence: (recordId: string) => Promise<void>;
}

export function AbsenceGuardian({
  modules,
  absences,
  onQuickLog,
  onDeleteAbsence,
}: AbsenceGuardianProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedModuleFilter, setSelectedModuleFilter] = useState<string>("all");

  const moduleStats = modules.map((m) => ({
    module: m,
    stats: calculateModuleAbsenceStats(absences, m),
  }));

  const modulesWithWarnings = moduleStats.filter((item) => item.stats.status === "warning");
  const modulesWithDanger = moduleStats.filter((item) => item.stats.status === "danger");

  const filteredAbsences = absences.filter((a) => {
    if (selectedModuleFilter === "all") return true;
    return a.moduleId === selectedModuleFilter;
  });

  return (
    <section className="rounded-[18px] border border-border/70 bg-surface p-3.5 sm:p-5 shadow-card space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-soft text-accent">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-sm sm:text-base font-bold text-text">
              Absences & Attendance Guardian
            </h2>
            <p className="text-[11px] text-faint">
              Strict TD & TP absence monitor (3 unexcused absences = exam exclusion).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-surface-2/40 px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-text hover:bg-surface-2 transition-colors"
        >
          <History className="h-3.5 w-3.5" />
          <span>History ({absences.length})</span>
        </button>
      </div>

      {/* Critical Danger Banner */}
      {modulesWithDanger.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-400">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
          <div>
            <span className="font-bold">EXCLUSION THRESHOLD REACHED:</span>
            <p className="text-[11px] mt-0.5 leading-relaxed">
              {modulesWithDanger.map((d) => `${d.module.code} (${d.stats.td.unexcused} TD / ${d.stats.tp.unexcused} TP)`).join(", ")}{" "}
              — You have reached or exceeded the 3-absence limit. Contact the administration or provide medical justification immediately to avoid being marked &quot;Non Admis&quot;.
            </p>
          </div>
        </div>
      )}

      {/* Warning Banner */}
      {modulesWithWarnings.length > 0 && modulesWithDanger.length === 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
          <div>
            <span className="font-bold">Caution (1 absence away from exclusion):</span>
            <p className="text-[11px] mt-0.5 leading-relaxed">
              {modulesWithWarnings.map((w) => `${w.module.code} (${w.stats.td.unexcused}/3 TD, ${w.stats.tp.unexcused}/3 TP)`).join(", ")}{" "}
              — You are one unexcused absence away from exclusion in these modules.
            </p>
          </div>
        </div>
      )}

      {/* Modules Absence Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-2.5">
        {moduleStats.map(({ module: m, stats }) => {
          const isDanger = stats.status === "danger";
          const isWarning = stats.status === "warning";

          return (
            <div
              key={m.id}
              className={`flex flex-col justify-between rounded-xl border p-2.5 transition-all text-xs ${
                isDanger
                  ? "border-rose-500/50 bg-rose-500/10"
                  : isWarning
                  ? "border-amber-500/50 bg-amber-500/10"
                  : "border-border/70 bg-surface-2/20 hover:border-border-strong"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-text truncate">{m.code}</span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    isDanger ? "bg-rose-500 animate-pulse" : isWarning ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                />
              </div>

              <div className="mt-2 space-y-1 text-[11px]">
                <div className="flex justify-between items-center text-muted">
                  <span>TD:</span>
                  <span className={`font-bold ${stats.td.unexcused >= 3 ? "text-rose-400" : stats.td.unexcused === 2 ? "text-amber-400" : "text-text"}`}>
                    {stats.td.unexcused}/{stats.td.limit}
                  </span>
                </div>
                <div className="flex justify-between items-center text-muted">
                  <span>TP:</span>
                  <span className={`font-bold ${stats.tp.unexcused >= 3 ? "text-rose-400" : stats.tp.unexcused === 2 ? "text-amber-400" : "text-text"}`}>
                    {stats.tp.unexcused}/{stats.tp.limit}
                  </span>
                </div>
                {stats.cours.unexcused > 0 && (
                  <div className="flex justify-between items-center text-faint text-[10px]">
                    <span>Cours:</span>
                    <span>{stats.cours.unexcused}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => onQuickLog(m.id)}
                className="mt-2.5 w-full rounded-lg bg-surface border border-border/60 py-1 text-[10px] font-semibold text-muted hover:text-text hover:border-accent transition-colors"
              >
                + Log
              </button>
            </div>
          );
        })}
      </div>

      {/* Absence History Modal */}
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="Absence History Log" wide>
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted">
              Total {filteredAbsences.length} record(s)
            </span>
            <select
              value={selectedModuleFilter}
              onChange={(e) => setSelectedModuleFilter(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-text outline-none"
            >
              <option value="all">All Modules</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code}
                </option>
              ))}
            </select>
          </div>

          {filteredAbsences.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-faint">
              No absences recorded.
            </div>
          ) : (
            <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1">
              {filteredAbsences.map((rec) => {
                const mod = modules.find((m) => m.id === rec.moduleId);
                return (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface-2/30 p-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text">{mod?.code || "Module"}</span>
                        <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted border border-border/60">
                          {rec.type}
                        </span>
                        {rec.justified ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Justified
                          </span>
                        ) : (
                          <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400">
                            Unexcused
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-faint mt-0.5">
                        {rec.date} {rec.note ? `· ${rec.note}` : ""}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteAbsence(rec.id)}
                      className="grid h-7 w-7 place-items-center rounded-lg text-faint hover:text-danger hover:bg-danger/10 transition-colors"
                      title="Delete record"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </section>
  );
}
