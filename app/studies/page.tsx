"use client";

import { useState, useMemo } from "react";
import {
  useStudiesData,
  type StudyModule,
} from "@/lib/data/domains/studies";
import { AcademicHeader } from "@/components/studies/AcademicHeader";
import { AbsenceGuardian } from "@/components/studies/AbsenceGuardian";
import { RevisionRoadmap } from "@/components/studies/RevisionRoadmap";
import { ModuleFormModal } from "@/components/studies/ModuleFormModal";
import { AbsenceLogModal } from "@/components/studies/AbsenceLogModal";
import { PresetLoaderModal } from "@/components/studies/PresetLoaderModal";
import { Hydrate } from "@/lib/hydration";
import { GraduationCap, Sparkles, Plus, BookOpen } from "lucide-react";

export default function StudiesPage() {
  const {
    profile,
    modules,
    checklist,
    absences,
    isLoading,
    setProfile,
    addModule,
    updateModule,
    deleteModule,
    toggleChecklist,
    addChecklist,
    deleteChecklist,
    addAbsence,
    removeAbsence,
    loadPreset,
  } = useStudiesData();

  // Modals state
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<StudyModule | null>(null);
  const [absenceModalOpen, setAbsenceModalOpen] = useState(false);
  const [absenceDefaultModuleId, setAbsenceDefaultModuleId] = useState<string | undefined>(undefined);

  const activeSemester = profile.currentSemester || "S1";

  // Filter modules for active semester
  const semesterModules = useMemo(() => {
    return modules.filter(
      (m) => !m.semester || m.semester.toLowerCase() === activeSemester.toLowerCase(),
    );
  }, [modules, activeSemester]);

  // Handle quick absence log from guardian or roadmap
  const handleQuickAbsenceLog = (moduleId?: string) => {
    setAbsenceDefaultModuleId(moduleId);
    setAbsenceModalOpen(true);
  };

  // Handle opening module edit modal
  const handleEditModule = (mod: StudyModule) => {
    setEditingModule(mod);
    setModuleModalOpen(true);
  };

  // Handle saving module from modal
  const handleSaveModule = async (data: {
    id?: string;
    code: string;
    name: string;
    level: string;
    semester: string;
    coefficient: number;
    color: string;
    icon: string;
    absenceLimits: { td: number; tp: number; cours: number };
  }) => {
    if (data.id) {
      await updateModule(data.id, data);
    } else {
      await addModule(data);
    }
  };

  return (
    <Hydrate>
      <div className="space-y-6">
        {/* Academic Header with profile, semester selector & readiness meter */}
        <AcademicHeader
          profile={profile}
          modules={modules}
          checklist={checklist}
          absences={absences}
          onUpdateProfile={setProfile}
          onOpenPresetModal={() => setPresetModalOpen(true)}
          onOpenModuleModal={() => {
            setEditingModule(null);
            setModuleModalOpen(true);
          }}
          onOpenAbsenceModal={() => handleQuickAbsenceLog()}
        />

        {/* Empty state when no modules exist */}
        {modules.length === 0 && !isLoading ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 sm:p-12 text-center space-y-5">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-accent-soft text-accent shadow-sm">
              <GraduationCap className="h-8 w-8" />
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <h3 className="font-display text-lg sm:text-xl font-bold text-text">
                Welcome to your Studies Dashboard
              </h3>
              <p className="text-xs sm:text-sm text-faint leading-relaxed">
                Track your ESI Algiers curriculum, revision progress across Cours, TD, TP & Annales, and safeguard against absence exclusions.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => loadPreset(profile.level || "2CPI", profile.currentSemester || "S1", "merge")}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs sm:text-sm font-semibold text-accent-contrast shadow-sm hover:opacity-95 transition"
              >
                <Sparkles className="h-4 w-4" />
                Load ESI {profile.level || "2CPI"} ({activeSemester}) Preset
              </button>

              <button
                type="button"
                onClick={() => setPresetModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs sm:text-sm font-medium text-text hover:bg-hover transition"
              >
                <BookOpen className="h-4 w-4 text-faint" />
                Browse All ESI Presets
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingModule(null);
                  setModuleModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs sm:text-sm font-medium text-text hover:bg-hover transition"
              >
                <Plus className="h-4 w-4 text-faint" />
                Custom Module
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Absence Guardian Section */}
            <AbsenceGuardian
              modules={semesterModules}
              absences={absences}
              onQuickLog={(modId) => handleQuickAbsenceLog(modId)}
              onDeleteAbsence={removeAbsence}
            />

            {/* Revision Roadmap Section */}
            <RevisionRoadmap
              modules={semesterModules}
              checklist={checklist}
              onToggleItem={toggleChecklist}
              onAddItem={async (item) => {
                await addChecklist(item);
              }}
              onDeleteItem={deleteChecklist}
              onEditModule={handleEditModule}
              onDeleteModule={deleteModule}
            />
          </div>
        )}

        {/* Modals */}
        <PresetLoaderModal
          open={presetModalOpen}
          onClose={() => setPresetModalOpen(false)}
          currentLevel={profile.level}
          currentSemester={profile.currentSemester}
          onLoad={loadPreset}
        />

        <ModuleFormModal
          open={moduleModalOpen}
          onClose={() => {
            setModuleModalOpen(false);
            setEditingModule(null);
          }}
          initialModule={editingModule}
          currentLevel={profile.level}
          currentSemester={profile.currentSemester}
          onSave={handleSaveModule}
        />

        <AbsenceLogModal
          open={absenceModalOpen}
          onClose={() => {
            setAbsenceModalOpen(false);
            setAbsenceDefaultModuleId(undefined);
          }}
          modules={semesterModules.length > 0 ? semesterModules : modules}
          defaultModuleId={absenceDefaultModuleId}
          onLog={async (record) => {
            await addAbsence(record);
          }}
        />
      </div>
    </Hydrate>
  );
}
