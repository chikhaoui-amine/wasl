# Google Calendar Connection & Sync Design Specification

* **Date**: 2026-10-08
* **Status**: Draft
* **Authors**: Antigravity & Amine Chikhaoui
* **Target Editions**: `wasl-cloud` (Full Cloud OAuth & Real-time Bidirectional Sync) and `wasl-local` (Offline .ics Import/Export Parity)

---

## 1. Overview & Problem Statement

WASL provides an internal time-blocking canvas ([`app/calendar/page.tsx`](file:///home/amine/wasl-cloud/app/calendar/page.tsx)) backed by the `blocks` domain ([`lib/data/domains/blocks/`](file:///home/amine/wasl-cloud/lib/data/domains/blocks/)). Users currently manage their daily and weekly schedules within WASL, but their external schedules live in Google Calendar.

This feature enables seamless **two-way synchronization** between WASL and Google Calendar:
1. External Google Calendar events appear directly on the WASL calendar canvas as editable time blocks.
2. Time blocks created, dragged, resized, or deleted within WASL are automatically pushed to the user's primary Google Calendar.
3. Edits from either service update the other using a predictable **Last-Write-Wins (LWW)** conflict resolution strategy.

---

## 2. Architecture & Dual-Edition Boundary

In accordance with the **WASL Mandatory Development Rules** ([`AGENTS.md`](file:///home/amine/wasl-cloud/AGENTS.md)):

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               WASL CLOUD EDITION                                │
│                                                                                 │
│   ┌────────────────────┐    HTTPS OAuth 2.0    ┌─────────────────────────────┐  │
│   │  /settings (OAuth) │──────────────────────>│ Google Identity & Calendar  │  │
│   └────────────────────┘                       └─────────────────────────────┘  │
│             │                                                 │                 │
│      Stores Tokens                                     Incremental Sync         │
│             ▼                                                 ▼                 │
│   ┌────────────────────┐      Sync Worker      ┌─────────────────────────────┐  │
│   │ user_integrations  │◀─────────────────────▶│ /api/integrations/google/  │  │
│   │ (Supabase Postgres)│                       │ (Pull / Push Endpoints)     │  │
│   └────────────────────┘                       └─────────────────────────────┘  │
│                                                               ▲                 │
│                                                   Serialized Mutation Hooks     │
│                                                               ▼                 │
│                                                ┌─────────────────────────────┐  │
│                                                │     useBlocksData Store     │  │
│                                                └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                               WASL LOCAL EDITION                                │
│                                                                                 │
│  100% Offline • Zero Network Credentials • Zero Third-Party Cloud Requests      │
│                                                                                 │
│   ┌─────────────────────────────┐                 ┌──────────────────────────┐  │
│   │    Calendar Toolbar (.ics)  │◀───────────────▶│ Local File System (.ics) │  │
│   └─────────────────────────────┘                 └──────────────────────────┘  │
│                  │                                                              │
│                  ▼                                                              │
│   ┌─────────────────────────────┐                                               │
│   │  LocalAdapter / Dexie Store │                                               │
│   └─────────────────────────────┘                                               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Edition Specifics:
1. **`wasl-cloud`**:
   - Manages Google OAuth 2.0 (`https://www.googleapis.com/auth/calendar.events`) with `access_type=offline`.
   - Credentials encrypted and isolated in Supabase Postgres table `user_integrations` guarded by Row-Level Security (RLS).
   - Server-side Next.js route handlers orchestrate authenticated sync against Google Calendar API (v3).
2. **`wasl-local`**:
   - Strict zero-credential and zero-network guarantee maintained.
   - Provides **.ics (iCalendar) Import & Export** so users can import `.ics` files exported from Google Calendar or export WASL schedules for offline import into external calendar clients.

---

## 3. Database Schema & Token Storage (`wasl-cloud`)

### Postgres Table: `public.user_integrations`
Added to [`supabase/schema.sql`](file:///home/amine/wasl-cloud/supabase/schema.sql) and as an idempotent migration in `supabase/migrations/`:

```sql
CREATE TABLE IF NOT EXISTS public.user_integrations (
  user_id           UUID REFERENCES auth.users (id) ON DELETE CASCADE,
  provider          TEXT NOT NULL, -- 'google_calendar'
  access_token      TEXT NOT NULL,
  refresh_token     TEXT,
  token_expiry      TIMESTAMPTZ,
  sync_token        TEXT,          -- Google Calendar incremental sync cursor
  calendar_id       TEXT DEFAULT 'primary',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, provider)
);

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own integrations only" ON public.user_integrations
  FOR ALL USING (auth.uid() = user_id);
```

### OAuth Endpoints
1. `GET /api/integrations/google/auth`: Initiates OAuth 2.0 redirect with state embedding user ID + anti-CSRF token.
2. `GET /api/integrations/google/callback`: Exchanges code for tokens, persists in `user_integrations`, redirects back to `/calendar`.
3. `POST /api/integrations/google/disconnect`: Revokes tokens at Google, deletes record from `user_integrations`.

---

## 4. Data Model Extensions (`blocks` Domain)

### Type Definitions (`lib/data/domains/blocks/types.ts`)
```ts
export interface Block {
  id: string;
  date: string;               // ISO day string 'YYYY-MM-DD'
  start: number;              // Decimal hours, e.g. 9.5 (09:30)
  end: number;                // Decimal hours, e.g. 11.0 (11:00)
  title: string;
  color: string;
  
  // Sync metadata (optional)
  externalId?: string;        // Google Calendar Event ID
  externalProvider?: "google";
  updatedAt?: string;         // ISO timestamp for last-write-wins resolution
  description?: string;       // Meeting links, notes, or descriptions
}

export interface BlocksPersistedState {
  blocks: Block[];
  view: "week" | "day";
  anchor: string;
  lastSyncedAt?: string;      // ISO timestamp of most recent successful sync
}
```

### Migrations & Store Registry
1. **Store Registry** ([`lib/data/store-registry.ts`](file:///home/amine/wasl-cloud/lib/data/store-registry.ts)): `lifeos-blocks` version bumped from `1` to `2`.
2. **Migrations** ([`lib/data/migrations.ts`](file:///home/amine/wasl-cloud/lib/data/migrations.ts)):
   ```ts
   "lifeos-blocks": (raw: unknown) => {
     const s = raw as any;
     return {
       blocks: Array.isArray(s?.blocks)
         ? s.blocks.map((b: any) => ({
             ...b,
             updatedAt: b.updatedAt ?? new Date().toISOString(),
           }))
         : [],
       view: s?.view === "day" ? "day" : "week",
       anchor: s?.anchor ?? getDefaultAnchor(),
       lastSyncedAt: s?.lastSyncedAt,
     };
   }
   ```
3. **Zod Validation** ([`lib/data/validation/domain-schemas.ts`](file:///home/amine/wasl-cloud/lib/data/validation/domain-schemas.ts)):
   Update `BlocksStateSchema` with optional `externalId`, `externalProvider`, `updatedAt`, `description`, and `lastSyncedAt`.

---

## 5. Bidirectional Sync Engine & Conflict Resolution

### Incremental Pull (`POST /api/integrations/google/sync/pull`)
* Triggered automatically on `/calendar` mount, on window focus (throttled to 60s), or on manual "Sync" button click.
* Calls Google Calendar API `events.list` using stored `sync_token`.
* If Google returns HTTP 410 (Gone / invalid token), gracefully falls back to a rolling 60-day window (`timeMin = now - 30d`, `timeMax = now + 30d`).
* Merges events via pure function `mergeGoogleEvents(blocks, incomingEvents)`.

### Push on Mutation (`POST /api/integrations/google/sync/push`)
* Hook observes local block mutations (create, update, drag, resize, delete).
* Uses 1.5-second debounce to avoid API thrashing during drag interactions.
* Translates block geometry into Google Calendar ISO strings with local timezone.
* Sends batched or single upsert/delete operations to Google Calendar.

### Conflict Resolution: Last-Write-Wins (LWW)
1. **`event.updated > block.updatedAt`**: Google event is newer; updates the local block.
2. **`block.updatedAt > event.updated`**: Local block is newer; dispatches patch to Google.
3. **`status === "cancelled"`**: Deleted on Google; deletes the matching block locally.
4. **Deleted locally**: Dispatches `events.delete` to Google Calendar.

---

## 6. UI & User Experience

### 1. Calendar Toolbar Sync Status
* Added to [`app/calendar/page.tsx`](file:///home/amine/wasl-cloud/app/calendar/page.tsx):
  * In **Cloud Edition**: A sync status indicator pill:
    * Connected & Synced: Green checkmark with relative time ("Synced 2m ago").
    * Syncing: Rotating spinner.
    * Disconnected: "Connect Google Calendar" button.
    * Expired: Amber warning icon ("Re-authenticate").
  * In **Local Edition**: An "Import / Export (.ics)" dropdown button.

### 2. Settings Integration Section
* In Cloud Edition's Settings page ([`components/settings/SettingsPage.tsx`](file:///home/amine/wasl-cloud/components/settings/SettingsPage.tsx)):
  * Displays Google account email, connection status, target calendar (`Primary`), and a "Disconnect" action.

---

## 7. MCP Integration Parity

Per `AGENTS.md`, calendar capabilities are exposed across all MCP layers:
1. `calendar_sync`: Triggers manual synchronization with connected external calendar.
2. `calendar_sync_status`: Inspects connection status, last sync timestamp, and pending sync count.

Updated files:
- [`lib/ai/tools.ts`](file:///home/amine/wasl-cloud/lib/ai/tools.ts) (Cloud tool execution)
- [`app/api/[transport]/route.ts`](file:///home/amine/wasl-cloud/app/api/[transport]/route.ts) (Remote MCP routes)
- [`packages/wasl-mcp-local/src/tool-definitions.ts`](file:///home/amine/wasl-cloud/packages/wasl-mcp-local/src/tool-definitions.ts) (Local STDIO definitions)
- [`lib/relay/local-executor.ts`](file:///home/amine/wasl-cloud/lib/relay/local-executor.ts) (Local loopback execution)

---

## 8. Testing & Verification Plan

1. **Unit Tests**:
   - `lib/data/domains/blocks/sync.test.ts`: Test pure conversion functions (decimal hours to ISO datetime, timezone handling, all-day events, `mergeGoogleEvents` LWW logic).
2. **Migration & Schema Drift**:
   - Verify `lib/data/schema-drift.test.ts` passes with store version 2.
   - Test backup import/export round-trip with legacy v1 backups.
3. **API & Mock Integration**:
   - Mock Google Calendar API tests covering token refresh, incremental sync, 410 fallback, and deletion propagation.
4. **Build & Lint Verification**:
   ```bash
   npm run lint
   npx tsc --noEmit
   npm test
   npm run build:local
   npm run build:cloud
   npm run build:mcp
   ```
