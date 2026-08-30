# Life Directions Filter Strip UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Life Directions & Goals filter strip on `/goals` into a sleek, single-line horizon strip with smooth horizontal overflow, edge fade indicators, zero-count badge suppression, and clean icon buttons across both `wasl-cloud` and `wasl-local`.

**Architecture:** Update `NorthStarFilterStrip` to enforce single-line layout (`shrink-0`, `flex-nowrap`, `overflow-x-auto no-scrollbar`), suppress count badges when `ns.count === 0`, and fix the duplicate plus icon on the Add Direction action. Update `app/goals/page.tsx` sorting to present active categories upfront. Mirror all changes and tests across `wasl-cloud` and `wasl-local`.

**Tech Stack:** Next.js, React, Tailwind CSS, Lucide Icons, Vitest.

## Global Constraints
- Apply dual-edition parity (`/home/amine/wasl-cloud` and `/home/amine/wasl-local`).
- Zero data model changes (purely UI/UX enhancement).
- Maintain all existing event handlers (`onSelect`, `onAddNorthStar`, `onEditNorthStar`, `onDeleteNorthStar`).

---

### Task 1: Update Tests for NorthStarFilterStrip

**Files:**
- Modify: `components/goals/NorthStarFilterStrip.test.tsx` (in both `wasl-cloud` and `wasl-local`)

**Interfaces:**
- `NorthStarFilterStripProps`

- [ ] **Step 1: Update tests to assert single-line structure, zero-badge suppression, and clean Add button text**

- [ ] **Step 2: Run test to observe any failures**

---

### Task 2: Implement Single-Line Horizon Strip in `NorthStarFilterStrip.tsx`

**Files:**
- Modify: `components/goals/NorthStarFilterStrip.tsx` (in both `wasl-cloud` and `wasl-local`)

- [ ] **Step 1: Update `NorthStarFilterStrip.tsx` component implementation**

- [ ] **Step 2: Run tests to verify they pass**

---

### Task 3: Polish Goals Page Integration and Active-First Category Ordering

**Files:**
- Modify: `app/goals/page.tsx` (in both `wasl-cloud` and `wasl-local`)

- [ ] **Step 1: Order active categories ahead of 0-count categories in `northStarsWithCount` for superior ergonomics**
- [ ] **Step 2: Run full test suite and typechecks across both editions**
