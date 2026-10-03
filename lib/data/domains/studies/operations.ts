import type {
  StudiesState,
  StudyModule,
  StudyChecklistItem,
  StudyAbsenceRecord,
  AcademicProfile,
  SessionType,
  AddStudyModuleInput,
  AddStudyChecklistItemInput,
} from "./types";
import { getPresetCurriculum } from "./presets";
import { DEFAULT_ABSENCE_LIMITS } from "./constants";

export function setAcademicProfile(
  state: StudiesState,
  profileUpdates: Partial<AcademicProfile>,
): StudiesState {
  return {
    ...state,
    profile: {
      ...state.profile,
      ...profileUpdates,
    },
  };
}

export function addStudyModule(
  state: StudiesState,
  input: AddStudyModuleInput,
): StudiesState {
  const now = new Date().toISOString();
  const id = input.id || `mod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const newModule: StudyModule = {
    id,
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    level: input.level || state.profile.level,
    semester: input.semester || state.profile.currentSemester,
    coefficient: typeof input.coefficient === "number" && input.coefficient >= 0 ? input.coefficient : 1,
    color: input.color || "#38bdf8",
    icon: input.icon || "BookOpen",
    absenceLimits: {
      td: input.absenceLimits?.td ?? DEFAULT_ABSENCE_LIMITS.td,
      tp: input.absenceLimits?.tp ?? DEFAULT_ABSENCE_LIMITS.tp,
      cours: input.absenceLimits?.cours ?? DEFAULT_ABSENCE_LIMITS.cours,
    },
    resources: input.resources || [],
    createdAt: now,
    updatedAt: now,
  };

  return {
    ...state,
    modules: [...state.modules, newModule],
  };
}

export function updateStudyModule(
  state: StudiesState,
  moduleId: string,
  updates: Partial<Omit<StudyModule, "id" | "createdAt">>,
): StudiesState {
  const now = new Date().toISOString();
  return {
    ...state,
    modules: state.modules.map((m) =>
      m.id === moduleId
        ? {
            ...m,
            ...updates,
            code: updates.code ? updates.code.trim().toUpperCase() : m.code,
            name: updates.name ? updates.name.trim() : m.name,
            updatedAt: now,
          }
        : m,
    ),
  };
}

export function deleteStudyModule(state: StudiesState, moduleId: string): StudiesState {
  return {
    ...state,
    modules: state.modules.filter((m) => m.id !== moduleId),
    checklist: state.checklist.filter((item) => item.moduleId !== moduleId),
    absences: state.absences.filter((ab) => ab.moduleId !== moduleId),
  };
}

export function addChecklistItem(
  state: StudiesState,
  input: AddStudyChecklistItemInput,
): StudiesState {
  const id = input.id || `chk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const newItem: StudyChecklistItem = {
    id,
    moduleId: input.moduleId,
    category: input.category,
    title: input.title.trim(),
    completed: Boolean(input.completed),
    completedAt: input.completedAt,
    order: typeof input.order === "number" ? input.order : state.checklist.length,
    url: input.url,
  };

  return {
    ...state,
    checklist: [...state.checklist, newItem],
  };
}

export function toggleChecklistItem(state: StudiesState, itemId: string): StudiesState {
  const now = new Date().toISOString();
  return {
    ...state,
    checklist: state.checklist.map((item) => {
      if (item.id !== itemId) return item;
      const nextCompleted = !item.completed;
      return {
        ...item,
        completed: nextCompleted,
        completedAt: nextCompleted ? now : undefined,
      };
    }),
  };
}

export function deleteChecklistItem(state: StudiesState, itemId: string): StudiesState {
  return {
    ...state,
    checklist: state.checklist.filter((item) => item.id !== itemId),
  };
}

export function logAbsence(
  state: StudiesState,
  input: Omit<StudyAbsenceRecord, "id"> & { id?: string },
): StudiesState {
  const id = input.id || `abs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const newAbsence: StudyAbsenceRecord = {
    id,
    moduleId: input.moduleId,
    type: input.type,
    date: input.date || new Date().toISOString().split("T")[0],
    justified: Boolean(input.justified),
    note: input.note?.trim() || undefined,
  };

  return {
    ...state,
    absences: [newAbsence, ...state.absences],
  };
}

export function deleteAbsence(state: StudiesState, recordId: string): StudiesState {
  return {
    ...state,
    absences: state.absences.filter((ab) => ab.id !== recordId),
  };
}

export function loadPresetCurriculum(
  state: StudiesState,
  level: string,
  semester: string,
  mode: "replace" | "merge" = "merge",
): StudiesState {
  const preset = getPresetCurriculum(level, semester);
  if (!preset) return state;

  const now = new Date().toISOString();
  let baseModules = state.modules;
  let baseChecklist = state.checklist;
  let baseAbsences = state.absences;

  if (mode === "replace") {
    // Remove existing modules for this level & semester
    const targetModuleIds = new Set(
      state.modules
        .filter((m) => m.level.toLowerCase() === level.toLowerCase() && m.semester.toLowerCase() === semester.toLowerCase())
        .map((m) => m.id),
    );
    baseModules = state.modules.filter((m) => !targetModuleIds.has(m.id));
    baseChecklist = state.checklist.filter((c) => !targetModuleIds.has(c.moduleId));
    baseAbsences = state.absences.filter((a) => !targetModuleIds.has(a.moduleId));
  }

  const existingCodes = new Set(
    baseModules
      .filter((m) => m.level.toLowerCase() === level.toLowerCase() && m.semester.toLowerCase() === semester.toLowerCase())
      .map((m) => m.code.toUpperCase()),
  );

  const newModulesToAdd: StudyModule[] = [];
  const newChecklistToAdd: StudyChecklistItem[] = [];

  for (const pMod of preset.modules) {
    if (existingCodes.has(pMod.code.toUpperCase())) {
      continue;
    }
    const newId = `mod-${pMod.code.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const mod: StudyModule = {
      ...pMod,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };
    newModulesToAdd.push(mod);

    // Look for preset checklist items for this module code
    const presetItems = preset.defaultChecklist.find((c) => c.moduleCode.toUpperCase() === pMod.code.toUpperCase());
    if (presetItems) {
      for (const item of presetItems.items) {
        newChecklistToAdd.push({
          ...item,
          id: `chk-${pMod.code.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          moduleId: newId,
          completed: false,
        });
      }
    }
  }

  return {
    ...state,
    profile: {
      ...state.profile,
      level,
      currentSemester: semester,
    },
    modules: [...baseModules, ...newModulesToAdd],
    checklist: [...baseChecklist, ...newChecklistToAdd],
    absences: baseAbsences,
  };
}

// -------------------------------------------------------------
// Metric & Calculation Helpers
// -------------------------------------------------------------

export interface SessionAbsenceBreakdown {
  unexcused: number;
  justified: number;
  limit: number;
}

export interface ModuleAbsenceStats {
  td: SessionAbsenceBreakdown;
  tp: SessionAbsenceBreakdown;
  cours: SessionAbsenceBreakdown;
  totalUnexcused: number;
  status: "safe" | "warning" | "danger";
}

export function calculateModuleAbsenceStats(
  absences: StudyAbsenceRecord[],
  module: StudyModule,
): ModuleAbsenceStats {
  const modAbsences = absences.filter((a) => a.moduleId === module.id);

  const countSession = (type: SessionType, limit: number): SessionAbsenceBreakdown => {
    const list = modAbsences.filter((a) => a.type === type);
    const unexcused = list.filter((a) => !a.justified).length;
    const justified = list.filter((a) => a.justified).length;
    return { unexcused, justified, limit };
  };

  const td = countSession("td", module.absenceLimits.td);
  const tp = countSession("tp", module.absenceLimits.tp);
  const cours = countSession("cours", module.absenceLimits.cours);

  const totalUnexcused = td.unexcused + tp.unexcused + cours.unexcused;

  // Determine traffic-light risk status:
  // If TD or TP is at or exceeds limit -> danger (exclusion)
  // If TD or TP is 1 away from limit (e.g. 2 when limit is 3) -> warning
  // Otherwise -> safe
  let status: "safe" | "warning" | "danger" = "safe";

  if (td.unexcused >= td.limit || tp.unexcused >= tp.limit) {
    status = "danger";
  } else if (td.unexcused === td.limit - 1 || tp.unexcused === tp.limit - 1) {
    status = "warning";
  }

  return {
    td,
    tp,
    cours,
    totalUnexcused,
    status,
  };
}

export function calculateModuleReadiness(
  checklist: StudyChecklistItem[],
  moduleId: string,
): number {
  const items = checklist.filter((item) => item.moduleId === moduleId);
  if (items.length === 0) return 0;
  const done = items.filter((item) => item.completed).length;
  return Math.round((done / items.length) * 100);
}

export function calculateOverallReadiness(
  checklist: StudyChecklistItem[],
  modules: StudyModule[],
): number {
  if (modules.length === 0) return 0;
  const moduleIds = new Set(modules.map((m) => m.id));
  const relevantItems = checklist.filter((item) => moduleIds.has(item.moduleId));
  if (relevantItems.length === 0) return 0;
  const done = relevantItems.filter((item) => item.completed).length;
  return Math.round((done / relevantItems.length) * 100);
}
