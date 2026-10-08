# Google Calendar Connection & Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement bidirectional synchronization between WASL's time-blocking calendar and Google Calendar for Cloud Edition, with offline `.ics` import/export for Local Edition, maintaining full schema parity and MCP integration.

**Architecture:** Extend the `blocks` domain with sync metadata (`externalId`, `updatedAt`, `description`) and version 2 migration. In Cloud Edition, handle OAuth 2.0 and token persistence in Supabase `user_integrations`, with server endpoints for incremental pull (`syncToken`) and debounced push (`insert`/`patch`/`delete`) using Last-Write-Wins conflict resolution. In Local Edition, provide file-based `.ics` import/export to preserve the 100% offline, credential-free boundary.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Auth/Postgres, Google Calendar API v3, Dexie IndexedDB, Zustand, Zod, Vitest.

## Global Constraints
- Dual-Edition Development Rule: Changes to shared types, validation schemas, stores, and migrations must apply to both `wasl-cloud` and `wasl-local`.
- Local Edition must remain 100% offline with zero network credentials and zero external API calls.
- Zero Data Loss: Pure migration in `lib/data/migrations.ts` and Zod validation in `lib/data/validation/domain-schemas.ts`.
- MCP Integration: New tools (`calendar_sync`, `calendar_sync_status`) must be registered across `lib/ai/tools.ts`, `app/api/[transport]/route.ts`, `packages/wasl-mcp-local/src/tool-definitions.ts`, and `lib/relay/local-executor.ts`.
- All destructive operations must use unique identifiers.

---

### Task 1: Extend Blocks Domain Types, Pure Migrations & Validation Schema

**Files:**
- Modify: `lib/data/domains/blocks/types.ts`
- Modify: `lib/data/domains/blocks/operations.ts`
- Modify: `lib/data/types.ts`
- Modify: `lib/data/store-registry.ts`
- Modify: `lib/data/migrations.ts`
- Modify: `lib/data/validation/domain-schemas.ts`
- Test: `lib/data/schema-drift.test.ts`

**Interfaces:**
- Consumes: Existing `Block` and `BlocksPersistedState`.
- Produces:
  ```ts
  export interface Block {
    id: string;
    date: string;
    start: number;
    end: number;
    title: string;
    color: string;
    externalId?: string;
    externalProvider?: "google";
    updatedAt?: string;
    description?: string;
  }
  export interface BlocksPersistedState {
    blocks: Block[];
    view: "week" | "day";
    anchor: string;
    lastSyncedAt?: string;
  }
  ```

- [ ] **Step 1: Write the failing schema drift test assertion**

In `lib/data/schema-drift.test.ts`, ensure `lifeos-blocks` is validated at version 2 with all new fields:

```ts
it("validates lifeos-blocks version 2 schema includes sync metadata", () => {
  const sampleV2 = {
    blocks: [
      {
        id: "b1",
        date: "2026-10-08",
        start: 9.0,
        end: 10.5,
        title: "Team Standup",
        color: "#7c9cf5",
        externalId: "gcal_12345",
        externalProvider: "google" as const,
        updatedAt: "2026-10-08T08:00:00.000Z",
        description: "https://meet.google.com/abc",
      },
    ],
    view: "week" as const,
    anchor: "2026-10-05",
    lastSyncedAt: "2026-10-08T08:00:00.000Z",
  };
  const parsed = BlocksStateSchema.parse(sampleV2);
  expect(parsed.blocks[0].externalId).toBe("gcal_12345");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/data/schema-drift.test.ts`
Expected: FAIL due to missing schema fields or store version mismatch.

- [ ] **Step 3: Update domain types, store registry, migrations, and validation**

1. Update `lib/data/domains/blocks/types.ts` and `lib/data/domains/blocks/operations.ts` with optional `externalId`, `externalProvider`, `updatedAt`, `description`.
2. Update `lib/data/types.ts` `BlocksPersistedState` with `lastSyncedAt?: string`.
3. In `lib/data/store-registry.ts`, bump `"lifeos-blocks"` version to `2`.
4. In `lib/data/migrations.ts`, register pure migration for `lifeos-blocks` that ensures all blocks retain their data and receive default `updatedAt`.
5. In `lib/data/validation/domain-schemas.ts`, update `BlocksStateSchema` with the optional fields.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/data/schema-drift.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/data/domains/blocks/ lib/data/types.ts lib/data/store-registry.ts lib/data/migrations.ts lib/data/validation/domain-schemas.ts lib/data/schema-drift.test.ts
git commit -m "feat(blocks): extend schema with sync metadata and register v2 migration"
```

---

### Task 2: Pure Calendar Conversion & Google Event Merge Utilities

**Files:**
- Create: `lib/calendar/google-sync-utils.ts`
- Test: `lib/calendar/google-sync-utils.test.ts`

**Interfaces:**
- Consumes: `Block` type, Google Calendar API event shape.
- Produces:
  ```ts
  export interface GoogleCalendarEvent {
    id: string;
    status?: "confirmed" | "tentative" | "cancelled";
    summary?: string;
    description?: string;
    updated?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string; timeZone?: string };
    colorId?: string;
  }

  export function googleEventToBlock(event: GoogleCalendarEvent, existingBlock?: Block): Block;
  export function blockToGoogleEvent(block: Block, timeZone: string): Partial<GoogleCalendarEvent>;
  export function mergeGoogleEvents(currentBlocks: Block[], incomingEvents: GoogleCalendarEvent[]): Block[];
  export function decimalHoursToIso(dateStr: string, hourDec: number, timeZone: string): string;
  export function isoToDecimalHours(isoString: string): { date: string; hour: number };
  ```

- [ ] **Step 1: Write failing unit tests for conversion and merge logic**

In `lib/calendar/google-sync-utils.test.ts`:
- Test timed event conversion from Google ISO string to WASL `date` and decimal `start`/`end`.
- Test all-day event conversion (maps to morning block with `[All-Day]`).
- Test WASL block to Google ISO datetime string formatting.
- Test Last-Write-Wins (LWW) conflict merge: Google newer overwrites local; local newer preserves local; cancelled status deletes local block.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/calendar/google-sync-utils.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `lib/calendar/google-sync-utils.ts`**

Implement conversion mathematics and pure state merge function handling `cancelled` deletions, timestamp comparisons, and ID correlation.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/calendar/google-sync-utils.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/calendar/google-sync-utils.ts lib/calendar/google-sync-utils.test.ts
git commit -m "feat(calendar): implement Google Calendar conversion and LWW merge utilities"
```

---

### Task 3: Cloud Database Schema & Migration for `user_integrations`

**Files:**
- Modify: `supabase/schema.sql`
- Create: `supabase/migrations/20261008000000_user_integrations.sql`
- Test: Verify against database schema parser in `lib/data/schema-drift.test.ts`

**Interfaces:**
- Produces: `public.user_integrations` table with RLS policy `own integrations only`.

- [ ] **Step 1: Write migration SQL**

Create `supabase/migrations/20261008000000_user_integrations.sql`:
```sql
CREATE TABLE IF NOT EXISTS public.user_integrations (
  user_id           UUID REFERENCES auth.users (id) ON DELETE CASCADE,
  provider          TEXT NOT NULL,
  access_token      TEXT NOT NULL,
  refresh_token     TEXT,
  token_expiry      TIMESTAMPTZ,
  sync_token        TEXT,
  calendar_id       TEXT DEFAULT 'primary',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, provider)
);

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own integrations only" ON public.user_integrations;
CREATE POLICY "own integrations only" ON public.user_integrations
  FOR ALL USING (auth.uid() = user_id);
```

- [ ] **Step 2: Mirror table definition in `supabase/schema.sql`**

Append table definition and RLS policies to `supabase/schema.sql` maintaining SQL parity.

- [ ] **Step 3: Verify schema parity and tests**

Run: `npx vitest run lib/data/schema-drift.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql supabase/migrations/20261008000000_user_integrations.sql
git commit -m "feat(db): add user_integrations table and migration for OAuth token storage"
```

---

### Task 4: Cloud OAuth & Token Management Handlers

**Files:**
- Create: `lib/integrations/google/auth.ts`
- Create: `app/api/integrations/google/auth/route.ts`
- Create: `app/api/integrations/google/callback/route.ts`
- Create: `app/api/integrations/google/disconnect/route.ts`
- Create: `app/api/integrations/google/status/route.ts`
- Test: `lib/integrations/google/auth.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/integrations/google/auth` -> redirects to Google OAuth 2.0.
  - `GET /api/integrations/google/callback` -> exchanges code, stores tokens, redirects to `/calendar?connected=true`.
  - `POST /api/integrations/google/disconnect` -> revokes tokens and deletes integration record.
  - `GET /api/integrations/google/status` -> returns `{ connected: boolean, lastSyncedAt?: string, email?: string }`.

- [ ] **Step 1: Write unit tests for OAuth URL generation and state verification**

In `lib/integrations/google/auth.test.ts`:
- Verify OAuth URL contains correct client_id, scopes (`https://www.googleapis.com/auth/calendar.events`), `access_type=offline`, and HMAC-signed state.
- Verify state token validation rejects tampered states.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/integrations/google/auth.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement OAuth utilities and route handlers**

1. Implement `lib/integrations/google/auth.ts` with `buildGoogleAuthUrl()`, `verifyStateToken()`, and `exchangeCodeForTokens()`.
2. Implement route handlers under `app/api/integrations/google/`.
3. Guard endpoints: return 404 in Local Edition (`isCloudEdition() === false`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/integrations/google/auth.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/integrations/google/ app/api/integrations/google/
git commit -m "feat(integrations): implement Google Calendar OAuth and status API routes"
```

---

### Task 5: Server-Side Bidirectional Sync Endpoints (`/pull` & `/push`)

**Files:**
- Create: `lib/integrations/google/client.ts`
- Create: `app/api/integrations/google/sync/pull/route.ts`
- Create: `app/api/integrations/google/sync/push/route.ts`
- Test: `lib/integrations/google/client.test.ts`

**Interfaces:**
- Produces:
  - `getValidGoogleToken(userId: string): Promise<string>` with auto-refresh using `refresh_token`.
  - `POST /api/integrations/google/sync/pull` -> calls `events.list` with `syncToken` (fallback on 410); returns `{ events, nextSyncToken }`.
  - `POST /api/integrations/google/sync/push` -> calls `events.insert`/`patch`/`delete`; returns confirmation with updated timestamps.

- [ ] **Step 1: Write unit tests for Google API client wrapper**

In `lib/integrations/google/client.test.ts`:
- Mock `fetch` to simulate token refresh when access token is expired.
- Mock `events.list` response with incremental sync token and HTTP 410 fallback.
- Mock `events.insert`, `patch`, and `delete`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/integrations/google/client.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `lib/integrations/google/client.ts` and sync route handlers**

1. Implement token refresher and API wrapper.
2. Implement `/pull` endpoint with cursor management and database persistence of `sync_token`.
3. Implement `/push` endpoint accepting batch mutations `{ upserts: Block[], deletes: string[] }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/integrations/google/client.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/integrations/google/client.ts lib/integrations/google/client.test.ts app/api/integrations/google/sync/
git commit -m "feat(integrations): implement Google Calendar pull and push server sync handlers"
```

---

### Task 6: Client Sync Hook & Serialized Mutation Integration

**Files:**
- Create: `lib/data/domains/blocks/useGoogleCalendarSync.ts`
- Modify: `lib/data/domains/blocks/hooks.ts`
- Test: `lib/data/domains/blocks/useGoogleCalendarSync.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function useGoogleCalendarSync(): {
    syncStatus: "idle" | "syncing" | "error" | "disconnected";
    lastSyncedAt?: string;
    syncNow: () => Promise<void>;
    connectGoogle: () => void;
    disconnectGoogle: () => Promise<void>;
  };
  ```

- [ ] **Step 1: Write test for sync hook state transitions**

In `lib/data/domains/blocks/useGoogleCalendarSync.test.ts`:
- Test mount triggers pull if connected.
- Test debounce triggers push after block mutation.
- Test error handling when offline.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/data/domains/blocks/useGoogleCalendarSync.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `useGoogleCalendarSync.ts`**

1. Integrate with `useBlocksData` and `useSerializedMutations`.
2. Implement throttled window focus listener and 1.5s debounce push queue.
3. Export from `lib/data/domains/blocks/index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/data/domains/blocks/useGoogleCalendarSync.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/data/domains/blocks/useGoogleCalendarSync.ts lib/data/domains/blocks/hooks.ts lib/data/domains/blocks/useGoogleCalendarSync.test.ts
git commit -m "feat(blocks): implement useGoogleCalendarSync hook with debounced push and focus pull"
```

---

### Task 7: Calendar UI Sync Status Toolbar Pill & Settings Integration

**Files:**
- Create: `components/calendar/GoogleSyncStatus.tsx`
- Modify: `app/calendar/page.tsx`
- Create: `components/settings/IntegrationsSettings.tsx`
- Modify: `components/settings/SettingsPage.tsx`

**Interfaces:**
- Produces:
  - Header pill in `app/calendar/page.tsx` displaying sync status and manual sync trigger.
  - New "Integrations" section in Cloud Settings allowing connect/disconnect of Google Calendar.

- [ ] **Step 1: Create `GoogleSyncStatus.tsx` component**

Renders:
- Spinner when syncing.
- Green dot + "Synced" when up-to-date with click-to-sync tooltip.
- "Connect Google" button when disconnected in Cloud edition.

- [ ] **Step 2: Mount `GoogleSyncStatus` in `app/calendar/page.tsx` toolbar**

Place alongside the view switcher and navigation controls in `app/calendar/page.tsx`.

- [ ] **Step 3: Create `IntegrationsSettings.tsx` and integrate into `SettingsPage.tsx`**

Provides Google connection status card with account email, primary calendar indicator, and disconnect confirmation dialog.

- [ ] **Step 4: Test UI rendering and verify styling**

Run: `npx vitest run components/calendar/` (or typecheck with `npx tsc --noEmit`).
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/calendar/GoogleSyncStatus.tsx app/calendar/page.tsx components/settings/IntegrationsSettings.tsx components/settings/SettingsPage.tsx
git commit -m "feat(ui): add Google Calendar sync toolbar status pill and settings integration card"
```

---

### Task 8: Local Edition .ics (iCalendar) Import & Export Parity

**Files:**
- Create: `lib/calendar/ics-utils.ts`
- Create: `components/calendar/IcsImportExportModal.tsx`
- Modify: `app/calendar/page.tsx`
- Test: `lib/calendar/ics-utils.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function exportBlocksToIcs(blocks: Block[]): string;
  export function parseIcsToBlocks(icsContent: string, targetAnchorDate: string): Block[];
  ```

- [ ] **Step 1: Write unit tests for iCalendar RFC 5545 generator and parser**

In `lib/calendar/ics-utils.test.ts`:
- Test generating valid `.ics` VCALENDAR/VEVENT content from WASL blocks.
- Test parsing imported `.ics` file into WASL blocks.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/calendar/ics-utils.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `lib/calendar/ics-utils.ts` and `IcsImportExportModal.tsx`**

1. Implement pure zero-dependency iCalendar serializer and parser.
2. Build modal for uploading `.ics` file or downloading `.ics` export.
3. Connect button to calendar toolbar in Local Edition (and as fallback in Cloud Edition).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/calendar/ics-utils.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/calendar/ics-utils.ts lib/calendar/ics-utils.test.ts components/calendar/IcsImportExportModal.tsx app/calendar/page.tsx
git commit -m "feat(calendar): implement offline .ics import and export for local edition parity"
```

---

### Task 9: MCP Tools Integration Across All Layers

**Files:**
- Modify: `lib/ai/tools.ts`
- Modify: `app/api/[transport]/route.ts`
- Modify: `packages/wasl-mcp-local/src/tool-definitions.ts`
- Modify: `lib/relay/local-executor.ts`
- Test: `lib/ai/tools.test.ts`

**Interfaces:**
- Produces MCP tools:
  - `calendar_sync`: Triggers manual sync with connected external calendar.
  - `calendar_sync_status`: Inspects provider, connection status, last sync timestamp.

- [ ] **Step 1: Write MCP tool registration test**

In `lib/ai/tools.test.ts`:
- Verify `calendar_sync` and `calendar_sync_status` are present in tool list and schema shapes match Zod definitions.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ai/tools.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement MCP tools across all 4 locations**

1. Implement tools in `lib/ai/tools.ts`.
2. Register zod shapes in `app/api/[transport]/route.ts`.
3. Add tool definitions to `packages/wasl-mcp-local/src/tool-definitions.ts`.
4. Add handler to `lib/relay/local-executor.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ai/tools.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/ai/tools.ts app/api/[transport]/route.ts packages/wasl-mcp-local/src/tool-definitions.ts lib/relay/local-executor.ts lib/ai/tools.test.ts
git commit -m "feat(mcp): add calendar_sync and calendar_sync_status across all MCP layers"
```

---

### Task 10: Dual-Edition Sync, Integration Verification & Build Suite

**Files:**
- Sync shared files to `/home/amine/wasl-local`
- Verification commands run across both editions

- [ ] **Step 1: Mirror shared domain files to `wasl-local`**

Sync `lib/data/domains/blocks/`, `lib/calendar/`, and `components/calendar/` to `wasl-local`.

- [ ] **Step 2: Run lint check**

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 3: Run TypeScript typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Run entire test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 5: Run production builds**

Run:
```bash
npm run build:local
npm run build:cloud
npm run build:mcp
```
Expected: All builds complete with exit code 0.

- [ ] **Step 6: Final commit and summary**

```bash
git commit -m "feat(calendar): complete Google Calendar integration and dual-edition sync suite"
```
