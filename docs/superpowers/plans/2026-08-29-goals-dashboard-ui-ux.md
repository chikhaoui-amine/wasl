# Goals Dashboard UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Goals page (`app/goals/page.tsx`) into an Executive Life Dashboard featuring a minimal summary strip, sleek North Star filter chips, interactive milestone checkboxes on goal cards, and list/grid view toggles.

**Architecture:** Modular component architecture under `components/goals/` consuming pure domain hooks from `lib/data/domains/goals`. Zero schema changes; 100% dual-edition parity across `wasl-local` (IndexedDB) and `wasl-cloud` (Supabase).

**Tech Stack:** Next.js 16 (React 19), Tailwind CSS, Lucide icons, Vitest, Testing Library.

## Global Constraints
- Dual-Edition Rule: Every component, test, and page update MUST be applied symmetrically to BOTH `wasl-local` and `wasl-cloud`.
- Test-Driven: Unit tests for all newly introduced presentational and interactive components.
- Zero Data Loss: Retain all existing goal data, types, milestones, and status workflows.

---

### Task 1: GoalSummaryStrip Component
**Files:**
- Create: `components/goals/GoalSummaryStrip.tsx`
- Create: `components/goals/GoalSummaryStrip.test.tsx`

**Interfaces:**
- Props: `{ activeGoalsCount: number; averageProgress: number; completedMilestones: number; totalMilestones: number }`

- [ ] **Step 1: Write unit tests in `GoalSummaryStrip.test.tsx`**
- [ ] **Step 2: Implement `GoalSummaryStrip.tsx`**
- [ ] **Step 3: Verify tests pass**

---

### Task 2: NorthStarFilterStrip Component
**Files:**
- Create: `components/goals/NorthStarFilterStrip.tsx`
- Create: `components/goals/NorthStarFilterStrip.test.tsx`

**Interfaces:**
- Props: `{ northStars: { id: string; title: string; description?: string; color?: string; count: number; isUserCreated?: boolean }[]; selectedId: string | null; onSelect: (id: string | null) => void; onAddNorthStar: () => void; onEditNorthStar?: (id: string) => void; onDeleteNorthStar?: (id: string) => void }`

- [ ] **Step 1: Write unit tests in `NorthStarFilterStrip.test.tsx`**
- [ ] **Step 2: Implement `NorthStarFilterStrip.tsx`**
- [ ] **Step 3: Verify tests pass**

---

### Task 3: Interactive GoalCard & GoalListRow Components
**Files:**
- Create: `components/goals/GoalCard.tsx`
- Create: `components/goals/GoalCard.test.tsx`
- Create: `components/goals/GoalListRow.tsx`

**Interfaces:**
- `GoalCard` Props: `{ goal: Goal; northStarMeta?: { id: string; title: string; color?: string }; linkedTaskCount?: number; onOpen: (goal: Goal) => void; onToggleMilestone: (goalId: string, milestoneId: string) => void }`
- `GoalListRow` Props: `{ goal: Goal; northStarMeta?: { id: string; title: string; color?: string }; onOpen: (goal: Goal) => void }`

- [ ] **Step 1: Write unit tests in `GoalCard.test.tsx` for rendering and milestone toggling**
- [ ] **Step 2: Implement `GoalCard.tsx` with inline milestone checkboxes**
- [ ] **Step 3: Implement `GoalListRow.tsx` for compact list view**
- [ ] **Step 4: Verify tests pass**

---

### Task 4: Assemble `app/goals/page.tsx` Dashboard
**Files:**
- Modify: `app/goals/page.tsx`
- Modify: `app/goals/page.test.tsx` (or update existing goal tests)

- [ ] **Step 1: Refactor `app/goals/page.tsx` with summary strip, filter chips, grid/list view switcher, and card list**
- [ ] **Step 2: Integrate archive section and delete/create modals**
- [ ] **Step 3: Run Vitest test suites and verify all pass**

---

### Task 5: Port to `wasl-cloud` & Full Verification
**Files:**
- Copy / mirror all new files and modifications to `wasl-cloud`
- Run lint, typecheck, Vitest, and production build on both editions.

- [ ] **Step 1: Copy components and page to `wasl-cloud`**
- [ ] **Step 2: Run `npm test` on both `wasl-local` and `wasl-cloud`**
- [ ] **Step 3: Run `npm run lint` and `tsc --noEmit` on both**
- [ ] **Step 4: Run `npm run build` on `wasl-local` and `npm run build:cloud` on `wasl-cloud`**
- [ ] **Step 5: Commit changes to `feature/goals-ui-ux` branch**
