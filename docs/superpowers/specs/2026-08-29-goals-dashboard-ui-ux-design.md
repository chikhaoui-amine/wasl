# Goals Dashboard UI/UX Redesign Specification

## 1. Overview & Objective
Redesign the **Goals Page** (`app/goals/page.tsx`) into a clean, minimalist, and high-clarity **Executive Life Dashboard**. The goal is to eliminate visual clutter (such as empty dashed preset boxes), provide instant visibility into life progress, and enable frictionless interaction with goals and milestones without overwhelming the user.

---

## 2. Key Architecture & Visual Structure

### 2.1 Header & Minimal Summary Strip
- **Header Bar**:
  - Page title: *"Life Directions & Goals"*
  - Year selector: `‹ 2026 ›` with prev/next buttons
  - View toggle: **Grid View** (rich cards) vs **List View** (compact rows)
  - Action buttons: `+ North Star` and primary `+ New Goal`
- **Minimalist 3-Metric Summary Strip**:
  - **Active Goals**: Total number of active goals for the selected year.
  - **Average Progress**: Calculated aggregate percentage across active goals.
  - **Milestones Velocity**: Completed milestones vs total milestones (e.g. `12 / 18 completed`).

### 2.2 North Star Filter Strip (Horizontal Chips)
- Replaces the bulky 2-column grid of preset North Star boxes.
- Displays horizontal scrolling/wrapping chips:
  - `All Goals (N)`
  - Individual North Stars (e.g. `🏃 Health & Vitality (2)`, `💼 Career & Mastery (1)`) with their distinctive color dot.
  - `+ Add Direction` button.
- **Selected Direction State**:
  - Highlights the active chip.
  - Displays a subtle, minimalist direction header with the North Star's description/vision quote and quick actions to edit/delete custom North Stars.

### 2.3 Interactive Goal Cards (`GoalCard.tsx`)
- **Grid Layout**: Responsive 2-column grid on desktop, 1-column on mobile.
- **Card Content**:
  - **Top Row**: North Star category pill (with color dot), Target Year/Span badge, Track Status pill (`On track`, `Behind`, `Done`), Focus flame icon if active focus.
  - **Title & Why**: High-contrast typography, optional 1-line "Why" subtitle.
  - **Inline Interactive Milestones**:
    - Displays the list of milestones with clickable checkboxes directly on the card so users can toggle milestones with 1 click.
    - Strikethrough style for completed milestones.
    - If more than 3 milestones exist, shows "+N more" or allows quick expanding.
  - **Bottom Row**:
    - Clean progress bar with animated accent fill.
    - Percentage text (e.g. `50%`) and milestone ratio (e.g. `2/4`).
    - Linked tasks count pill if any tasks are linked to this goal.
  - **Card Interaction**:
    - Clicking the card body opens the full `GoalDetail` modal.
    - Clicking the milestone checkbox toggles the milestone via `toggleMilestone(goal.id, milestone.id)` without opening the modal.

### 2.4 Compact List View (`GoalListRow.tsx`)
- Provides a clean, dense tabular row view for users who prefer scanning many goals quickly.
- Shows Title, North Star pill, Milestones done/total, Days left / Period, and Progress bar.

### 2.5 Collapsible Completed & Archive Section
- A clean accordion section at the bottom of the page:
  - `Completed & Archived (N)`
  - Expands to show completed or paused goals in compact rows with full restore/unarchive capabilities.

---

## 3. Data Flow & State Management

- **Domain Hook**: Utilizes `useGoalsData()` from `lib/data/domains/goals`.
- **Milestone Toggle**: Direct mutation via `toggleMilestone(goalId, milestoneId)`.
- **Persistence**: 100% compliant with existing `DataAdapter` interface and migration schemas. No schema changes required since all attributes (`milestones`, `type`, `northStarId`, `category`, `status`, `completed`) are already supported by the domain model.
- **Dual-Edition Parity**: Implemented symmetrically across `wasl-local` (Dexie/IndexedDB) and `wasl-cloud` (Supabase/Postgres).

---

## 4. Verification & Testing Plan

### 4.1 Unit & Component Tests
- `components/goals/GoalCard.test.tsx`:
  - Renders goal title, North Star category, progress, and milestones.
  - Toggles milestone on checkbox click.
  - Triggers card open handler on body click.
- `app/goals/page.test.tsx` / existing goal test suites:
  - Tests North Star filtering, year switching, and active/completed separation.

### 4.2 Automated Checks
- `npm run lint` (0 errors)
- `npm run typecheck` (`tsc --noEmit`)
- `npm test` (all Vitest suites pass)
- `npm run build` (`wasl-local`) and `npm run build:cloud` (`wasl-cloud`).
