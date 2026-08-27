# WASL Data Architecture

WASL is designed as a **local-first personal management system** that operates completely offline on the user's device.

---

## 1. The 11 Domain Stores

WASL structures personal life management across 11 distinct domains:

1. **Tasks (`lifeos-tasks`)**: Active tasks, subtasks, overdue tracking, focus tags, and goal linkage.
2. **Goals (`lifeos-goals`)**: North Stars, Outcomes, Challenges with milestones, targets, and progress rings.
3. **Notes (`lifeos-notes`)**: Second-brain notes with tags, pinned status, color coding, and markdown preview.
4. **Blocks (`lifeos-blocks`)**: Daily schedule time-blocks and calendar integrations.
5. **Journal (`lifeos-journal`)**: Day-grouped timeline entries with time markers and mood ratings.
6. **Habits (`lifeos-habits`)**: Daily habit routines, 12-week completion grids, and streak calculations.
7. **Health (`lifeos-health`)**: Training programs, workout logging, exercise library, sleep metrics, and hydration.
8. **Money (`lifeos-money`)**: Income/expense transactions, categorization, monthly runway, and savings targets.
9. **Topics (`lifeos-topics`)**: Dedicated learning pages with roadmaps, milestones, and resource links.
10. **Recurring (`lifeos-recurring`)**: Recurring task templates with cadence rules and idempotency keys.
11. **Trash (`lifeos-trash`)**: Soft-deletion archive allowing non-destructive restore across all domains.

---

## 2. Storage Adapter

### LocalAdapter (`lib/data/adapters/local/`)
- **Engine**: IndexedDB managed through **Dexie.js** (database name: `wasl-local`).
- **Offline First**: All operations execute synchronously against local IndexedDB transactions with zero external network calls.
- **Migration Engine**: Automatic schema migration and non-destructive legacy key ingestion from `localStorage`.

---

## 3. Query & State Layer

All UI components interact with domain hooks powered by **TanStack Query** (`@tanstack/react-query`):
- Clean separation between data queries and mutations.
- Automatic background revalidation and memory cache management.
- Live queries update UI instantly on mutations.

---

## 4. Non-Destructive Migrations

All stores implement versioned migration handlers:
- State upgrades never discard unmigrated data or reset user history.
- Unknown schema versions are safely preserved rather than wiped.
