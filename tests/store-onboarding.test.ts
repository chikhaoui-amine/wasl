// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { useUI } from "@/lib/store";

describe("useUI onboarding state", () => {
  beforeEach(() => {
    useUI.getState().setOnboardingOpen(false);
  });

  it("toggles onboardingOpen state correctly", () => {
    expect(useUI.getState().onboardingOpen).toBe(false);
    useUI.getState().setOnboardingOpen(true);
    expect(useUI.getState().onboardingOpen).toBe(true);
    useUI.getState().setOnboardingOpen(false);
    expect(useUI.getState().onboardingOpen).toBe(false);
  });
});
