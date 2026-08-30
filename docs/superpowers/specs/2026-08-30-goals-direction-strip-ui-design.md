# Goals Life Directions Filter Strip Redesign

## Problem Statement
The current Life Directions & Goals filter strip on `/goals` wraps into an awkward second line on standard desktop screens (leaving 1–2 chips isolated), shows redundant `0` count badges across inactive categories, displays duplicate `+ + Add Direction` icons, and adds excessive visual clutter.

## Design Goals
1. **Single-Line Horizon Strip**: Ensure the filter bar always stays strictly on a single row, never breaking into a multi-line layout.
2. **Smooth Horizontal Overflow & Fade Masks**: When categories exceed container width, allow smooth horizontal scrolling with subtle gradient fade masks on edges and optional navigation chevrons.
3. **Smart Badges (Noise Reduction)**: Hide `0` badges on inactive categories so only categories with active goals (`count > 0`) highlight numbers.
4. **Visual Polish**: Fix the double-plus button (`+ + Add Direction` -> `<Plus /> Add Direction`), add smooth transitions, and maintain high-contrast active states.
5. **Dual-Edition Parity**: Apply the updated component and tests across both `wasl-cloud` and `wasl-local`.

## Detailed Specifications

### 1. `NorthStarFilterStrip` Component (`components/goals/NorthStarFilterStrip.tsx`)
- **Container**:
  - Outer wrapper with horizontal scroll support (`overflow-x-auto no-scrollbar scroll-smooth`).
  - Subtle edge gradient fade masks when scrollable, ensuring users understand it scrolls horizontally.
  - Flex items with `shrink-0 flex-nowrap` to prevent line wrapping.
- **Pill Styles**:
  - `All Directions`: Icon (`Compass`) + label + total count badge.
  - `Direction Chips`:
    - Dot color indicator (`h-2 w-2 rounded-full`).
    - Direction title with truncation if extremely long (`max-w-[160px] truncate`).
    - Count badge: **Only rendered if `ns.count > 0`**.
    - Active state: `bg-accent text-white shadow-xs border-accent` (or category tint) with crisp contrast.
    - Inactive state: `bg-surface-2/80 text-muted border-border/70 hover:border-border-strong hover:text-text`.
- **Add Direction Button**:
  - Pill with `<Plus className="h-3 w-3" />` and text `Add Direction`.
  - Border dashed `border-border/80 hover:border-accent hover:text-accent`.
- **Vision Banner**:
  - Retains the contextual vision quote when an individual North Star is active.

### 2. Goal Page Integration (`app/goals/page.tsx`)
- Prioritize active categories (categories with `count > 0` and user-created directions) first in the display sequence, followed by inactive preset categories, providing maximum usability.

### 3. Unit Tests (`components/goals/NorthStarFilterStrip.test.tsx`)
- Verify rendering of "All Directions" and category chips.
- Verify that `0` count badges are not rendered.
- Verify vision quote banner visibility when selected.

## Verification Plan
- `npm test` in both `wasl-cloud` and `wasl-local`.
- `npm run lint` and `npx tsc --noEmit` / `npm run typecheck`.
- Visual / DOM confirmation.
