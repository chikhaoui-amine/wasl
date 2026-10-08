// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useGoogleCalendarSync } from "./useGoogleCalendarSync";

describe("useGoogleCalendarSync (Local Edition)", () => {
  it("returns disconnected status in local edition", () => {
    const { result } = renderHook(() => useGoogleCalendarSync());
    expect(result.current.connected).toBe(false);
    expect(result.current.configured).toBe(false);
    expect(result.current.syncStatus).toBe("idle");
  });
});
