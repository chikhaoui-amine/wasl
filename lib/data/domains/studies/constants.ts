import type {
  StudiesState,
  StudyModule,
  StudyChecklistItem,
  StudyAbsenceRecord,
  AcademicProfile,
  StudyResourceLink,
} from "./types";

export const DEFAULT_ABSENCE_LIMITS = {
  td: 3,
  tp: 3,
  cours: 5,
} as const;

export const DEFAULT_ACADEMIC_PROFILE: AcademicProfile = {
  level: "2CPI",
  currentSemester: "S1",
  academicYear: "2026-2027",
};

export function createDefaultStudiesState(): StudiesState {
  return {
    version: 1,
    profile: { ...DEFAULT_ACADEMIC_PROFILE },
    modules: [],
    checklist: [],
    absences: [],
  };
}

export function normalizeStudiesState(raw: unknown): StudiesState {
  if (!raw || typeof raw !== "object") {
    return createDefaultStudiesState();
  }

  const r = raw as Partial<StudiesState>;

  const profile: AcademicProfile = {
    level: typeof r.profile?.level === "string" && r.profile.level.trim() ? r.profile.level.trim() : "2CPI",
    currentSemester: typeof r.profile?.currentSemester === "string" && r.profile.currentSemester.trim() ? r.profile.currentSemester.trim() : "S1",
    academicYear: typeof r.profile?.academicYear === "string" && r.profile.academicYear.trim() ? r.profile.academicYear.trim() : "2026-2027",
  };

  const modules: StudyModule[] = Array.isArray(r.modules)
    ? r.modules.map((rawM: unknown, idx: number) => {
        const m = (rawM && typeof rawM === "object" ? rawM : {}) as Record<string, unknown>;
        const limits = (m.absenceLimits && typeof m.absenceLimits === "object"
          ? m.absenceLimits
          : {}) as Record<string, unknown>;
        return {
          id: typeof m.id === "string" && m.id ? m.id : `module-${idx + 1}`,
          code: typeof m.code === "string" && m.code ? m.code.toUpperCase() : "MOD",
          name: typeof m.name === "string" && m.name ? m.name : "Module",
          level: typeof m.level === "string" ? m.level : profile.level,
          semester: typeof m.semester === "string" ? m.semester : profile.currentSemester,
          coefficient: typeof m.coefficient === "number" && m.coefficient >= 0 ? m.coefficient : 1,
          color: typeof m.color === "string" ? m.color : "#38bdf8",
          icon: typeof m.icon === "string" ? m.icon : "BookOpen",
          absenceLimits: {
            td: typeof limits.td === "number" ? limits.td : DEFAULT_ABSENCE_LIMITS.td,
            tp: typeof limits.tp === "number" ? limits.tp : DEFAULT_ABSENCE_LIMITS.tp,
            cours: typeof limits.cours === "number" ? limits.cours : DEFAULT_ABSENCE_LIMITS.cours,
          },
          resources: Array.isArray(m.resources)
            ? m.resources.map((rawRes: unknown, rIdx: number) => {
                const res = (rawRes && typeof rawRes === "object" ? rawRes : {}) as Record<string, unknown>;
                return {
                  id: typeof res.id === "string" ? res.id : `res-${rIdx}`,
                  label: typeof res.label === "string" ? res.label : "Resource",
                  url: typeof res.url === "string" ? res.url : "",
                  type: typeof res.type === "string" ? (res.type as StudyResourceLink["type"]) : "other",
                };
              })
            : [],
          createdAt: typeof m.createdAt === "string" ? m.createdAt : new Date().toISOString(),
          updatedAt: typeof m.updatedAt === "string" ? m.updatedAt : new Date().toISOString(),
        };
      })
    : [];

  const checklist: StudyChecklistItem[] = Array.isArray(r.checklist)
    ? r.checklist.map((rawItem: unknown, idx: number) => {
        const item = (rawItem && typeof rawItem === "object" ? rawItem : {}) as Record<string, unknown>;
        const validCategories = ["cours", "td_series", "tp", "annale"] as const;
        const cat = typeof item.category === "string" && validCategories.includes(item.category as typeof validCategories[number])
          ? (item.category as typeof validCategories[number])
          : "cours";
        return {
          id: typeof item.id === "string" && item.id ? item.id : `check-${idx + 1}`,
          moduleId: typeof item.moduleId === "string" ? item.moduleId : "",
          category: cat,
          title: typeof item.title === "string" && item.title ? item.title : `Item ${idx + 1}`,
          completed: Boolean(item.completed),
          completedAt: typeof item.completedAt === "string" ? item.completedAt : undefined,
          order: typeof item.order === "number" ? item.order : idx,
          url: typeof item.url === "string" ? item.url : undefined,
        };
      })
    : [];

  const absences: StudyAbsenceRecord[] = Array.isArray(r.absences)
    ? r.absences.map((rawAb: unknown, idx: number) => {
        const ab = (rawAb && typeof rawAb === "object" ? rawAb : {}) as Record<string, unknown>;
        const validTypes = ["td", "tp", "cours"] as const;
        const abType = typeof ab.type === "string" && validTypes.includes(ab.type as typeof validTypes[number])
          ? (ab.type as typeof validTypes[number])
          : "td";
        return {
          id: typeof ab.id === "string" && ab.id ? ab.id : `abs-${idx + 1}`,
          moduleId: typeof ab.moduleId === "string" ? ab.moduleId : "",
          type: abType,
          date: typeof ab.date === "string" ? ab.date : new Date().toISOString().split("T")[0],
          justified: Boolean(ab.justified),
          note: typeof ab.note === "string" ? ab.note : undefined,
        };
      })
    : [];

  return {
    version: 1,
    profile,
    modules,
    checklist,
    absences,
  };
}
