// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { testLocalStorage } = vi.hoisted(() => {
  const storageValues = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return storageValues.size;
    },
    clear: () => storageValues.clear(),
    getItem: (key) => storageValues.get(key) ?? null,
    key: (index) => [...storageValues.keys()][index] ?? null,
    removeItem: (key) => {
      storageValues.delete(key);
    },
    setItem: (key, value) => {
      storageValues.set(key, value);
    },
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  return { testLocalStorage: storage };
});

import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AboutWaslSection } from "@/components/settings/LocalStorageSettings";
import { useUI } from "@/lib/store";

describe("AboutWaslSection in Settings", () => {
  beforeEach(() => {
    testLocalStorage.clear();
    useUI.getState().setOnboardingOpen(false);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders About WASL section and triggers onboarding modal when clicking reopen button", () => {
    render(<AboutWaslSection />);

    expect(screen.getByText(/About WASL/i)).toBeDefined();
    const reopenBtn = screen.getByRole("button", { name: /Revisit welcome guide|Open guide/i });
    expect(reopenBtn).toBeDefined();

    expect(useUI.getState().onboardingOpen).toBe(false);
    fireEvent.click(reopenBtn);
    expect(useUI.getState().onboardingOpen).toBe(true);
  });
});
