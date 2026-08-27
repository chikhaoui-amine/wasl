// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

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
import { LocalOnboardingModal, ONBOARDING_STORAGE_KEY } from "@/components/onboarding/LocalOnboardingModal";
import { afterEach } from "vitest";

// Mock next/navigation
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("LocalOnboardingModal", () => {
  beforeEach(() => {
    testLocalStorage.clear();
    pushMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders when open and displays all essential sections", () => {
    render(<LocalOnboardingModal open={true} onClose={vi.fn()} />);

    // 1. Welcome section
    expect(screen.getByText("Your life, connected.")).toBeDefined();
    expect(screen.getByText(/personal operating system/i)).toBeDefined();

    // 2. Theme picker
    expect(screen.getByText("Choose your visual style")).toBeDefined();
    expect(screen.getByText("Graphite")).toBeDefined();
    expect(screen.getByText("Porcelain")).toBeDefined();

    // 3. Storage and data responsibility warning
    expect(screen.getByText("Your data stays with you")).toBeDefined();
    expect(screen.getByText(/Your local data is your responsibility — create backups/i)).toBeDefined();

    // 4. Connected context
    expect(screen.getByText(/Why WASL is useful/i)).toBeDefined();
    expect(screen.getByText(/Goal → today's task → scheduled time → completion → review/i)).toBeDefined();

    // 5. MCP AI Section
    expect(screen.getByText(/AI that understands your actual system — MCP/i)).toBeDefined();
    expect(screen.getByText(/Plan my day from my active goals/i)).toBeDefined();
    expect(screen.getByText(/Learn how to connect MCP/i)).toBeDefined();

    // 6. Final CTA
    expect(screen.getByRole("button", { name: /I understand — enter WASL/i })).toBeDefined();
  });

  it("does not render modal contents when open is false", () => {
    const { container } = render(<LocalOnboardingModal open={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("saves completion flag and triggers onClose when clicking the primary button", () => {
    const onClose = vi.fn();
    render(<LocalOnboardingModal open={true} onClose={onClose} />);

    const ctaBtn = screen.getByRole("button", { name: /I understand — enter WASL/i });
    fireEvent.click(ctaBtn);

    expect(testLocalStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("true");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("navigates to settings AI tab when clicking Learn how to connect MCP", () => {
    const onClose = vi.fn();
    render(<LocalOnboardingModal open={true} onClose={onClose} />);

    const mcpLink = screen.getByRole("button", { name: /Learn how to connect MCP/i });
    fireEvent.click(mcpLink);

    expect(pushMock).toHaveBeenCalledWith("/settings");
    expect(onClose).toHaveBeenCalled();
  });
});
