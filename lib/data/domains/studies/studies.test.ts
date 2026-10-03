import { describe, it, expect } from "vitest";
import { createDefaultStudiesState } from "./constants";
import {
  setAcademicProfile,
  addStudyModule,
  updateStudyModule,
  deleteStudyModule,
  toggleChecklistItem,
  addChecklistItem,
  deleteChecklistItem,
  logAbsence,
  deleteAbsence,
  loadPresetCurriculum,
  calculateModuleAbsenceStats,
  calculateModuleReadiness,
  calculateOverallReadiness,
} from "./operations";

describe("studies operations & business logic", () => {
  it("updates academic profile properly", () => {
    let state = createDefaultStudiesState();
    state = setAcademicProfile(state, { level: "1CS", currentSemester: "S2", academicYear: "2026-2027" });
    expect(state.profile.level).toBe("1CS");
    expect(state.profile.currentSemester).toBe("S2");
  });

  it("adds, updates and deletes a module with cascading cleanup", () => {
    let state = createDefaultStudiesState();
    state = addStudyModule(state, {
      code: "SFSD",
      name: "Structures de Fichiers & Données",
      level: "2CPI",
      semester: "S1",
      coefficient: 4,
      color: "#38bdf8",
      icon: "FolderTree",
      absenceLimits: { td: 3, tp: 3, cours: 5 },
      resources: [],
    });

    expect(state.modules).toHaveLength(1);
    const modId = state.modules[0].id;
    expect(state.modules[0].code).toBe("SFSD");

    // Add checklist and absence linked to this module
    state = addChecklistItem(state, {
      moduleId: modId,
      category: "cours",
      title: "Ch 1: Organisation de fichiers",
      order: 1,
    });
    state = logAbsence(state, {
      moduleId: modId,
      type: "td",
      date: "2026-10-05",
      justified: false,
    });
    expect(state.checklist).toHaveLength(1);
    expect(state.absences).toHaveLength(1);

    // Update module
    state = updateStudyModule(state, modId, { coefficient: 5 });
    expect(state.modules[0].coefficient).toBe(5);

    // Delete module -> cascading delete
    state = deleteStudyModule(state, modId);
    expect(state.modules).toHaveLength(0);
    expect(state.checklist).toHaveLength(0);
    expect(state.absences).toHaveLength(0);
  });

  it("toggles checklist items and sets completion timestamp", () => {
    let state = createDefaultStudiesState();
    state = addStudyModule(state, {
      code: "SE1",
      name: "Systèmes d'Exploitation",
      level: "2CPI",
      semester: "S2",
      coefficient: 4,
      color: "#0284c7",
      icon: "Terminal",
      absenceLimits: { td: 3, tp: 3, cours: 5 },
      resources: [],
    });
    const modId = state.modules[0].id;

    state = addChecklistItem(state, {
      moduleId: modId,
      category: "td_series",
      title: "Série 1: Ordonnancement",
      order: 1,
    });
    const itemId = state.checklist[0].id;
    expect(state.checklist[0].completed).toBe(false);

    // Toggle on
    state = toggleChecklistItem(state, itemId);
    expect(state.checklist[0].completed).toBe(true);
    expect(typeof state.checklist[0].completedAt).toBe("string");

    // Toggle off
    state = toggleChecklistItem(state, itemId);
    expect(state.checklist[0].completed).toBe(false);
    expect(state.checklist[0].completedAt).toBeUndefined();

    // Delete item
    state = deleteChecklistItem(state, itemId);
    expect(state.checklist).toHaveLength(0);
  });

  it("calculates absence metrics and safety status correctly (limit = 3)", () => {
    const mod = {
      id: "mod-1",
      code: "SFSD",
      name: "SFSD",
      level: "2CPI",
      semester: "S1",
      coefficient: 4,
      color: "#38bdf8",
      icon: "FolderTree",
      absenceLimits: { td: 3, tp: 3, cours: 5 },
      resources: [],
      createdAt: "",
      updatedAt: "",
    };

    // 0 absences -> safe
    let stats = calculateModuleAbsenceStats([], mod);
    expect(stats.td.unexcused).toBe(0);
    expect(stats.status).toBe("safe");

    // 1 unexcused + 1 justified -> safe (justified doesn't count against limit)
    const absences1 = [
      { id: "a1", moduleId: "mod-1", type: "td" as const, date: "2026-10-01", justified: false },
      { id: "a2", moduleId: "mod-1", type: "td" as const, date: "2026-10-08", justified: true },
    ];
    stats = calculateModuleAbsenceStats(absences1, mod);
    expect(stats.td.unexcused).toBe(1);
    expect(stats.td.justified).toBe(1);
    expect(stats.status).toBe("safe");

    // 2 unexcused -> warning (1 away from 3!)
    const absences2 = [
      ...absences1,
      { id: "a3", moduleId: "mod-1", type: "td" as const, date: "2026-10-15", justified: false },
    ];
    stats = calculateModuleAbsenceStats(absences2, mod);
    expect(stats.td.unexcused).toBe(2);
    expect(stats.status).toBe("warning");

    // 3 unexcused -> danger (exclusion!)
    const absences3 = [
      ...absences2,
      { id: "a4", moduleId: "mod-1", type: "td" as const, date: "2026-10-22", justified: false },
    ];
    stats = calculateModuleAbsenceStats(absences3, mod);
    expect(stats.td.unexcused).toBe(3);
    expect(stats.status).toBe("danger");
  });

  it("calculates module and overall readiness percentages safely", () => {
    const modules = [
      { id: "m1", code: "SFSD", name: "SFSD", level: "2CPI", semester: "S1", coefficient: 4, color: "", icon: "", absenceLimits: { td: 3, tp: 3, cours: 5 }, resources: [], createdAt: "", updatedAt: "" },
      { id: "m2", code: "ARCHI2", name: "ARCHI2", level: "2CPI", semester: "S1", coefficient: 4, color: "", icon: "", absenceLimits: { td: 3, tp: 3, cours: 5 }, resources: [], createdAt: "", updatedAt: "" },
    ];

    // Empty checklist
    expect(calculateModuleReadiness([], "m1")).toBe(0);
    expect(calculateOverallReadiness([], modules)).toBe(0);

    const checklist = [
      { id: "c1", moduleId: "m1", category: "cours" as const, title: "1", completed: true, order: 1 },
      { id: "c2", moduleId: "m1", category: "cours" as const, title: "2", completed: false, order: 2 },
      { id: "c3", moduleId: "m2", category: "cours" as const, title: "3", completed: true, order: 1 },
      { id: "c4", moduleId: "m2", category: "cours" as const, title: "4", completed: true, order: 2 },
    ];

    // m1: 1 / 2 = 50%
    expect(calculateModuleReadiness(checklist, "m1")).toBe(50);
    // m2: 2 / 2 = 100%
    expect(calculateModuleReadiness(checklist, "m2")).toBe(100);
    // overall: 3 / 4 = 75%
    expect(calculateOverallReadiness(checklist, modules)).toBe(75);
  });

  it("loads ESI presets in replace and merge modes", () => {
    let state = createDefaultStudiesState();
    state = loadPresetCurriculum(state, "2CPI", "S1", "replace");

    expect(state.modules.length).toBeGreaterThan(0);
    expect(state.checklist.length).toBeGreaterThan(0);
    const initialCount = state.modules.length;

    // Load same preset in merge mode: does not duplicate existing modules
    state = loadPresetCurriculum(state, "2CPI", "S1", "merge");
    expect(state.modules.length).toBe(initialCount);

    // Test absence deletion
    state = logAbsence(state, {
      moduleId: state.modules[0].id,
      type: "tp",
      date: "2026-10-06",
      justified: false,
    });
    const absId = state.absences[0].id;
    expect(state.absences).toHaveLength(1);
    state = deleteAbsence(state, absId);
    expect(state.absences).toHaveLength(0);
  });
});
