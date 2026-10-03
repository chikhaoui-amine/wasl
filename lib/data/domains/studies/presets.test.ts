import { describe, it, expect } from "vitest";
import { createDefaultStudiesState, normalizeStudiesState } from "./constants";
import { ESI_CURRICULUM_PRESETS, getPresetCurriculum } from "./presets";

describe("studies constants & presets", () => {
  it("initializes a valid default studies state and exports curriculum presets", () => {
    const state = createDefaultStudiesState();
    expect(state.version).toBe(1);
    expect(state.profile.level).toBe("2CPI");
    expect(state.modules).toEqual([]);
    expect(state.checklist).toEqual([]);
    expect(state.absences).toEqual([]);
    expect(ESI_CURRICULUM_PRESETS.length).toBeGreaterThan(0);
  });

  it("normalizes incomplete or corrupted state safely", () => {
    const normalized = normalizeStudiesState(null);
    expect(normalized.version).toBe(1);
    expect(normalized.profile.level).toBe("2CPI");
    expect(Array.isArray(normalized.modules)).toBe(true);

    const partial = normalizeStudiesState({
      modules: [{ id: "m1", code: "SFSD", name: "SFSD", semester: "S1" }],
    });
    expect(partial.modules[0].coefficient).toBe(1);
    expect(partial.modules[0].absenceLimits.td).toBe(3);
  });

  it("contains official 2CPI S1 and S2 presets with correct modules and coefficients", () => {
    const s1 = getPresetCurriculum("2CPI", "S1");
    expect(s1).toBeDefined();
    const codes = s1?.modules.map((m) => m.code);
    expect(codes).toContain("SFSD");
    expect(codes).toContain("ARCHI2");
    expect(codes).toContain("AN");
    expect(codes).toContain("PRST");

    const sfsd = s1?.modules.find((m) => m.code === "SFSD");
    expect(sfsd?.coefficient).toBe(4);
    expect(sfsd?.absenceLimits.td).toBe(3);
    expect(sfsd?.absenceLimits.tp).toBe(3);

    const s2 = getPresetCurriculum("2CPI", "S2");
    expect(s2).toBeDefined();
    const s2Codes = s2?.modules.map((m) => m.code);
    expect(s2Codes).toContain("SE1");
    expect(s2Codes).toContain("POO");
    expect(s2Codes).toContain("TG");

    const se1 = s2?.modules.find((m) => m.code === "SE1");
    expect(se1?.coefficient).toBe(4);
  });

  it("contains 1CPI and 1CS presets as well", () => {
    const cpi1 = getPresetCurriculum("1CPI", "S1");
    expect(cpi1).toBeDefined();
    expect(cpi1?.modules.map((m) => m.code)).toContain("ALGO1");

    const cs1 = getPresetCurriculum("1CS", "S1");
    expect(cs1).toBeDefined();
    expect(cs1?.modules.map((m) => m.code)).toContain("THL");
  });
});
