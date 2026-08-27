// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import {
  ICON_MAP,
  HABIT_ICONS,
  PROJECT_ICONS,
  TOPIC_ICONS,
  DEFAULT_ICON,
  iconKeyFromLegacy,
  getIconComponent,
  DynamicIcon,
} from "./icons";

describe("Icon System & DynamicIcon Resilience", () => {
  it("all curated icon lists contain valid ICON_MAP keys", () => {
    for (const key of HABIT_ICONS) {
      expect(key in ICON_MAP, `HABIT_ICONS entry '${key}' should exist in ICON_MAP`).toBe(true);
      expect(ICON_MAP[key]).toBeDefined();
    }
    for (const key of PROJECT_ICONS) {
      expect(key in ICON_MAP, `PROJECT_ICONS entry '${key}' should exist in ICON_MAP`).toBe(true);
      expect(ICON_MAP[key]).toBeDefined();
    }
    for (const key of TOPIC_ICONS) {
      expect(key in ICON_MAP, `TOPIC_ICONS entry '${key}' should exist in ICON_MAP`).toBe(true);
      expect(ICON_MAP[key]).toBeDefined();
    }
  });

  describe("iconKeyFromLegacy", () => {
    it("handles exact match lowercase keys", () => {
      expect(iconKeyFromLegacy("activity")).toBe("activity");
      expect(iconKeyFromLegacy("moon")).toBe("moon");
      expect(iconKeyFromLegacy("droplets")).toBe("droplets");
      expect(iconKeyFromLegacy("sparkles")).toBe("sparkles");
    });

    it("handles PascalCase and camelCase strings", () => {
      expect(iconKeyFromLegacy("Activity")).toBe("activity");
      expect(iconKeyFromLegacy("Moon")).toBe("moon");
      expect(iconKeyFromLegacy("Droplets")).toBe("droplets");
      expect(iconKeyFromLegacy("BookOpen")).toBe("book-open");
      expect(iconKeyFromLegacy("ChefHat")).toBe("chef-hat");
      expect(iconKeyFromLegacy("CheckCircle")).toBe("check-circle");
    });

    it("handles legacy emojis safely", () => {
      expect(iconKeyFromLegacy("💧")).toBe("droplets");
      expect(iconKeyFromLegacy("🌙")).toBe("moon");
      expect(iconKeyFromLegacy("📖")).toBe("book-open");
      expect(iconKeyFromLegacy("🏋️")).toBe("dumbbell");
      expect(iconKeyFromLegacy("🔥")).toBe("flame");
    });

    it("falls back to DEFAULT_ICON safely on invalid, empty, or unknown strings", () => {
      expect(iconKeyFromLegacy(undefined)).toBe(DEFAULT_ICON);
      expect(iconKeyFromLegacy("")).toBe(DEFAULT_ICON);
      expect(iconKeyFromLegacy("   ")).toBe(DEFAULT_ICON);
      expect(iconKeyFromLegacy("completely-invalid-icon-name-xyz")).toBe(DEFAULT_ICON);
      expect(iconKeyFromLegacy("123456")).toBe(DEFAULT_ICON);
    });
  });

  describe("getIconComponent", () => {
    it("always returns a valid React component function", () => {
      const validComp = getIconComponent("activity");
      expect(typeof validComp).toBe("object"); // Lucide icon forwardRef object or function

      const fallbackComp = getIconComponent("nonexistent-xyz");
      expect(typeof fallbackComp).toBe("object");

      const undefinedComp = getIconComponent(undefined);
      expect(typeof undefinedComp).toBe("object");
    });
  });

  describe("DynamicIcon Component", () => {
    it("renders without crashing for valid, invalid, uppercase, and undefined icons", () => {
      const testCases = [
        "activity",
        "Activity",
        "droplets",
        "Droplets",
        "Moon",
        "moon",
        "BookOpen",
        "book-open",
        "💧",
        "🌙",
        "non-existent-icon",
        "",
        undefined,
      ];

      for (const name of testCases) {
        const { container } = render(
          <DynamicIcon name={name} className="h-4 w-4" style={{ color: "#37c9b7" }} />,
        );
        const svg = container.querySelector("svg");
        expect(svg, `DynamicIcon should render an svg for input '${name}'`).not.toBeNull();
      }
    });
  });
});
