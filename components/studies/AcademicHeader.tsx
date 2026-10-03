"use client";

import { useState } from "react";
import {
  AVAILABLE_ACADEMIC_LEVELS,
  type AcademicProfile,
  type StudyModule,
  type StudyChecklistItem,
  type StudyAbsenceRecord,
  calculateOverallReadiness,
  calculateModuleAbsenceStats,
} from "@/lib/data/domains/studies";
import { ProgressBar } from "@/components/ui/primitives";
import { Sparkles, Plus, AlertTriangle, ShieldCheck, ShieldAlert, ChevronDown } from "lucide-react";

interface AcademicHeaderProps {
  profile: AcademicProfile;
  modules: StudyModule[];
  checklist: StudyChecklistItem[];
  absences: StudyAbsenceRecord[];
  onUpdateProfile: (updates: Partial<AcademicProfile>) => Promise<void>;
  onOpenPresetModal: () => void;
  onOpenModuleModal: () => void;
  onOpenAbsenceModal: () => void;
}

export function AcademicHeader({
  profile,
  modules,
  checklist,
  absences,
  onUpdateProfile,
  onOpenPresetModal,
  onOpenModuleModal,
  onOpenAbsenceModal,
}: AcademicHeaderProps) {
  const [levelDropdownOpen, setLevelDropdownOpen] = useState(false);

  const activeSemester = profile.currentSemester || "S1";
  const semesterModules = modules.filter(
    (m) => !m.semester || m.semester.toLowerCase() === activeSemester.toLowerCase(),
  );

  const overallReadiness = calculateOverallReadiness(checklist, semesterModules);

  // Calculate worst absence status across active semester modules
  let worstStatus: "safe" | "warning" | "danger" = "safe";
  let warningCount = 0;
  let dangerCount = 0;

  for (const m of semesterModules) {
    const stats = calculateModuleAbsenceStats(absences, m);
    if (stats.status === "danger") {
      worstStatus = "danger";
      dangerCount++;
    } else if (stats.status === "warning") {
      if (worstStatus !== "danger") worstStatus = "warning";
      warningCount++;
    }
  }

  return (
    <section className="rounded-[18px] border border-border/70 bg-surface p-3.5 sm:p-5 shadow-card space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Left: Academic Profile & Level/Semester controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Level selector dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setLevelDropdownOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-surface-2/60 px-3 py-1.5 text-xs font-bold text-text hover:bg-surface-2 transition-colors"
            >
              <span>{profile.level}</span>
              <ChevronDown className="h-3 w-3 text-muted" />
            </button>

            {levelDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setLevelDropdownOpen(false)}
                />
                <div className="absolute left-0 top-full mt-1.5 z-50 min-w-[150px] rounded-xl border border-border/80 bg-surface p-1 shadow-lg">
                  {AVAILABLE_ACADEMIC_LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        onUpdateProfile({ level: lvl });
                        setLevelDropdownOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                        profile.level === lvl
                          ? "bg-accent/15 text-accent font-bold"
                          : "text-text hover:bg-surface-2"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Semester toggle pills */}
          <div className="flex items-center rounded-xl bg-surface-2/80 p-0.5 border border-border/60">
            {["S1", "S2"].map((sem) => {
              const active = activeSemester.toUpperCase() === sem;
              return (
                <button
                  key={sem}
                  type="button"
                  onClick={() => onUpdateProfile({ currentSemester: sem })}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                    active
                      ? "bg-accent text-accent-fg shadow-sm"
                      : "text-muted hover:text-text"
                  }`}
                >
                  {sem}
                </button>
              );
            })}
          </div>

          <span className="text-[11px] text-faint ml-1 hidden md:inline">
            {profile.academicYear} · {semesterModules.length} Modules
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenPresetModal}
            className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-surface-2/50 px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-2 hover:border-accent/40 transition-all shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span>Load ESI Preset</span>
          </button>

          <button
            type="button"
            onClick={onOpenAbsenceModal}
            className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-surface-2/50 px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-2 transition-all shadow-sm"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span>Log Absence</span>
          </button>

          <button
            type="button"
            onClick={onOpenModuleModal}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-1.5 text-xs font-bold text-accent-fg shadow-sm hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Module</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/60">
        {/* Overall Exam Readiness */}
        <div className="flex flex-col justify-between rounded-xl bg-surface-2/30 border border-border/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text">Overall Exam Readiness</span>
            <span className="font-bold text-accent">{overallReadiness}% Ready</span>
          </div>
          <ProgressBar value={overallReadiness} className="mt-2 h-1.5" />
        </div>

        {/* Absence Safety Badge */}
        <div className="flex items-center justify-between rounded-xl bg-surface-2/30 border border-border/50 p-3 text-xs">
          <div className="flex items-center gap-2">
            {worstStatus === "safe" ? (
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/15 text-emerald-500">
                <ShieldCheck className="h-4 w-4" />
              </span>
            ) : worstStatus === "warning" ? (
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-500/15 text-amber-500">
                <AlertTriangle className="h-4 w-4" />
              </span>
            ) : (
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-rose-500/15 text-rose-500">
                <ShieldAlert className="h-4 w-4" />
              </span>
            )}
            <div>
              <p className="font-bold text-text">
                {worstStatus === "safe"
                  ? "All Clear & Safe"
                  : worstStatus === "warning"
                  ? `${warningCount} Module(s) near exclusion limit`
                  : `${dangerCount} Module(s) in EXCLUSION danger`}
              </p>
              <p className="text-[10px] text-faint">
                {worstStatus === "safe"
                  ? "Zero modules at risk of exclusion from exams."
                  : worstStatus === "warning"
                  ? "1 unexcused absence away from EMD exclusion!"
                  : "3+ unexcused absences reached! Provide justification immediately."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
