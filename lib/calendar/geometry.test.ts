import { describe, expect, it } from "vitest";
import {
  clamp,
  snap,
  pxToHour,
  computeMove,
  computeResizeTop,
  computeResizeBottom,
  computeCreateRange,
} from "./geometry";

const DAY_START = 5;
const DAY_END = 23;

describe("snap", () => {
  it("snaps to 15-minute increments", () => {
    expect(snap(9.1)).toBe(9);
    expect(snap(9.2)).toBe(9.25);
    expect(snap(9.4)).toBe(9.5);
    expect(snap(9.9)).toBe(10);
  });
});

describe("clamp", () => {
  it("bounds within range", () => {
    expect(clamp(3, 5, 23)).toBe(5);
    expect(clamp(30, 5, 23)).toBe(23);
    expect(clamp(10, 5, 23)).toBe(10);
  });
});

describe("pxToHour", () => {
  it("maps pixels to decimal hour", () => {
    // rectTop=100, hourH=54, dayStart=5. 27px below top = half an hour.
    expect(pxToHour(127, 100, 54, 5)).toBeCloseTo(5.5);
  });
});

describe("computeMove", () => {
  it("preserves duration and snaps", () => {
    expect(computeMove(10.1, 0, 1, DAY_START, DAY_END)).toEqual({ start: 10, end: 11 });
  });
  it("accounts for grab offset", () => {
    // grabbed 0.5h into a 2h block, pointer at 12 -> start 11.5
    expect(computeMove(12, 0.5, 2, DAY_START, DAY_END)).toEqual({ start: 11.5, end: 13.5 });
  });
  it("clamps at bottom keeping duration", () => {
    expect(computeMove(30, 0, 2, DAY_START, DAY_END)).toEqual({ start: 21, end: 23 });
  });
  it("clamps at top", () => {
    expect(computeMove(0, 0, 2, DAY_START, DAY_END)).toEqual({ start: 5, end: 7 });
  });
});

describe("computeResizeTop", () => {
  it("moves start, keeps end", () => {
    expect(computeResizeTop(9.1, 11, DAY_START)).toEqual({ start: 9, end: 11 });
  });
  it("enforces min duration", () => {
    expect(computeResizeTop(11, 11, DAY_START)).toEqual({ start: 10.75, end: 11 });
  });
  it("clamps to dayStart", () => {
    expect(computeResizeTop(2, 11, DAY_START)).toEqual({ start: 5, end: 11 });
  });
});

describe("computeResizeBottom", () => {
  it("moves end, keeps start", () => {
    expect(computeResizeBottom(11.9, 9, DAY_END)).toEqual({ start: 9, end: 12 });
  });
  it("enforces min duration", () => {
    expect(computeResizeBottom(9, 9, DAY_END)).toEqual({ start: 9, end: 9.25 });
  });
  it("clamps to dayEnd", () => {
    expect(computeResizeBottom(30, 9, DAY_END)).toEqual({ start: 9, end: 23 });
  });
});

describe("computeCreateRange", () => {
  it("orders anchor and pointer", () => {
    expect(computeCreateRange(12, 9, DAY_START, DAY_END)).toEqual({ start: 9, end: 12 });
  });
  it("snaps both ends", () => {
    expect(computeCreateRange(9.1, 10.9, DAY_START, DAY_END)).toEqual({ start: 9, end: 11 });
  });
  it("enforces min duration when barely dragged", () => {
    expect(computeCreateRange(9, 9.02, DAY_START, DAY_END)).toEqual({ start: 9, end: 9.25 });
  });
  it("keeps min duration at the very bottom", () => {
    expect(computeCreateRange(23, 23, DAY_START, DAY_END)).toEqual({ start: 22.75, end: 23 });
  });
});
