// Pure geometry helpers for the calendar grid drag interactions.
// No React, no DOM — all math is testable in isolation.

export const SNAP = 0.25; // 15 minutes, in decimal hours
export const MIN_DUR = 0.25; // minimum block duration

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Snap a decimal hour to the nearest SNAP increment. */
export const snap = (hour: number) => Math.round(hour / SNAP) * SNAP;

/**
 * Convert a pointer Y (clientY) into a decimal hour, given the column's top edge,
 * pixels-per-hour, and the hour the grid starts at.
 */
export const pxToHour = (clientY: number, rectTop: number, hourH: number, dayStart: number) =>
  dayStart + (clientY - rectTop) / hourH;

/**
 * Move a block so its start lands near `pointerHour` minus the grab offset.
 * Duration is preserved; the block is clamped inside [dayStart, dayEnd].
 */
export function computeMove(
  pointerHour: number,
  grabOffset: number, // hours between block.start and where the user grabbed
  dur: number,
  dayStart: number,
  dayEnd: number,
): { start: number; end: number } {
  let start = snap(pointerHour - grabOffset);
  start = clamp(start, dayStart, dayEnd - dur);
  return { start, end: start + dur };
}

/** Resize the top edge: move `start`, keep `end`, enforce MIN_DUR. */
export function computeResizeTop(
  pointerHour: number,
  end: number,
  dayStart: number,
): { start: number; end: number } {
  const start = clamp(snap(pointerHour), dayStart, end - MIN_DUR);
  return { start, end };
}

/** Resize the bottom edge: move `end`, keep `start`, enforce MIN_DUR. */
export function computeResizeBottom(
  pointerHour: number,
  start: number,
  dayEnd: number,
): { start: number; end: number } {
  const end = clamp(snap(pointerHour), start + MIN_DUR, dayEnd);
  return { start, end };
}

/**
 * Normalize a create-drag from anchor→pointer into an ordered, snapped,
 * clamped range with at least MIN_DUR duration.
 */
export function computeCreateRange(
  anchorHour: number,
  pointerHour: number,
  dayStart: number,
  dayEnd: number,
): { start: number; end: number } {
  const a = snap(clamp(anchorHour, dayStart, dayEnd));
  const b = snap(clamp(pointerHour, dayStart, dayEnd));
  let start = Math.min(a, b);
  let end = Math.max(a, b);
  if (end - start < MIN_DUR) end = Math.min(dayEnd, start + MIN_DUR);
  if (end - start < MIN_DUR) start = Math.max(dayStart, end - MIN_DUR);
  return { start, end };
}
