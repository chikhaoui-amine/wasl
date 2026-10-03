import { describe, it, expect } from "vitest";
import {
  createDefaultStudiesState,
  normalizeStudiesState,
  DEFAULT_ABSENCE_LIMITS,
  ESI_CURRICULUM_PRESETS,
  getPresetCurriculum,
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
} from "./index";

describe("studies barrel index exports", () => {
  it("exports all expected domain constants, functions and helpers", () => {
    expect(createDefaultStudiesState).toBeDefined();
    expect(normalizeStudiesState).toBeDefined();
    expect(DEFAULT_ABSENCE_LIMITS.td).toBe(3);
    expect(ESI_CURRICULUM_PRESETS.length).toBeGreaterThan(0);
    expect(getPresetCurriculum).toBeDefined();
    expect(setAcademicProfile).toBeDefined();
    expect(addStudyModule).toBeDefined();
    expect(updateStudyModule).toBeDefined();
    expect(deleteStudyModule).toBeDefined();
    expect(toggleChecklistItem).toBeDefined();
    expect(addChecklistItem).toBeDefined();
    expect(deleteChecklistItem).toBeDefined();
    expect(logAbsence).toBeDefined();
    expect(deleteAbsence).toBeDefined();
    expect(loadPresetCurriculum).toBeDefined();
    expect(calculateModuleAbsenceStats).toBeDefined();
    expect(calculateModuleReadiness).toBeDefined();
    expect(calculateOverallReadiness).toBeDefined();
  });
});
