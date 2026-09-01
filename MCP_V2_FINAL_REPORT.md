# WASL MCP V2 Final Report

Date: 2026-09-01

## Final architecture

- WASL uses `@modelcontextprotocol/sdk` `^1.26.0` and `mcp-handler` `^1.1.0`. Cloud HTTP/SSE and Local STDIO tools use the installed SDK's `outputSchema` plus native `structuredContent`.
- Every result crosses a shared response boundary: reads return `{ ok: true, data }`; writes return `{ ok: true, data, operation }`; failures return `{ ok: false, error: { code, message, retryable, details? } }`.
- Cloud registration is centralized in `app/api/[transport]/route.ts`. Local STDIO registration is generated from `packages/wasl-mcp-local/src/tool-definitions.ts`; Local execution remains adapter-backed in `lib/relay/local-executor.ts`.
- `packages/wasl-mcp-local/src/tool-catalog.ts` is the shared public-name and deprecation catalog. Public names now follow `<domain>_<operation>` (`notes_list`, `notes_search`, `notes_get`, `notes_create`, `notes_update`, `notes_append`, `notes_delete`, and equivalent domain families).
- Tool descriptions explicitly mark `READ-ONLY` or `MUTATES DATA`, identify immutable ID fields, and describe idempotency, optimistic concurrency, and confirmation requirements.
- `system_capabilities_get` exposes the caller's effective permission, allowed domains, mutation safeguards, and the legacy-name migration map without exposing credentials or server internals.
- Permissions, domain allowlists, immutable-ID resolution, `expectedVersion`, `idempotencyKey`, destructive confirmation, and audit logging are enforced before writes. Domain deletes are recoverable through Trash where supported; permanent actions require exact confirmation.
- The canonical 11-store registry remains authoritative. `lifeos-projects`, `lifeos-reviews`, and `lifeos-routines` remain isolated archives and are not exposed as active MCP domains. No user data is deleted.
- Cloud exposes 119 unique canonical tools. Local exposes 59 unique canonical tools matching the features implemented by its executor. No legacy alias is simultaneously registered.

## Deprecated public names

Old names are no longer exposed as competing tools. Their replacements are returned by `system_capabilities_get` and exported as `MCP_DEPRECATED_TOOLS`.

- System: `mcp_capabilities` → `system_capabilities_get`; `get_sync_status` → `sync_status_get`; `get_money` → `money_overview_get`; `get_health` → `health_overview_get`.
- Tasks/notes: `add_*`, `update_*`, and `delete_*` → `tasks_*` or `notes_*`; `set_daily_focus` → `tasks_daily_focus_set`; `set_note_pinned` → `notes_pinned_set`.
- Goals/habits/calendar/journal/recurring: legacy verb-first names → domain-first `*_create`, `*_update`, `*_delete`, or explicit `*_completed_set` names.
- Topics: topic, step, substep, resource, and topic-note mutations → `topics_*`, `topic_steps_*`, `topic_substeps_*`, `topic_resources_*`, and `topic_notes_*`.
- Health/money: legacy `log_*`, account, transaction, savings, program, exercise, workout, and active-workout names → their domain-first equivalents.
- Trash: `restore_trash_item` → `trash_restore`; `delete_trash_item_permanently` → `trash_delete_permanently`; `empty_trash` → `trash_empty`.
- `search_all` is retired. Call the relevant permission-scoped `notes_search`, `tasks_search`, `goals_search`, or `topics_search` tool instead.
- Earlier bulk/duplicate APIs such as `get_notes_topics`, legacy project tools, and toggle operations remain unregistered.

The complete exact mapping lives in `packages/wasl-mcp-local/src/tool-catalog.ts`.

## Test coverage and results

The canonical lifecycle smoke test in `lib/relay/mcp-v2-smoke.test.ts` covers:

- create → get → update → verify → recoverable delete → Trash get → restore → verify;
- Arabic/Unicode and a large note body;
- search and cursor pagination with non-overlapping pages;
- idempotent create/append retries;
- stale `expectedVersion` rejection;
- read-only permission denial;
- invalid public schema input;
- preservation and isolation of archived legacy data.

The Cloud transport suite verifies initialization, canonical tool discovery, descriptions, structured read/write/error responses, output schemas, permission checks, safe error redaction, and destructive confirmations. Adapter suites verify both `LocalAdapter` and `CloudAdapter`, including CAS conflicts, older-snapshot migrations, newer-schema rejection, active-store validation, and archived-store isolation.

Verification completed:

| Check | Result |
| --- | --- |
| Cloud typecheck | Passed |
| Local typecheck | Passed (`--incremental false` because the Local workspace is read-only to the sandbox) |
| Cloud tests | 65 files passed, 1 skipped; 496 tests passed, 1 skipped |
| Local tests | 51 files passed; 357 tests passed |
| Focused MCP V2 suite | 5 files, 41 tests passed |
| Cloud lint | 0 errors; 58 pre-existing warnings outside this MCP change |
| Local lint | 0 errors; 55 pre-existing warnings outside this MCP change |
| Local production build | Passed |
| Cloud production build | Passed |
| Cloud and Local STDIO MCP builds | Passed |

## Remaining limitations

- Optimistic concurrency versions are store-level `updatedAt` tokens, not per-entity counters. Unrelated writes in the same store can therefore cause a safe, retryable conflict.
- The Local tool surface is intentionally smaller than Cloud where the Local executor has no corresponding domain mutation yet; unsupported tools are not advertised.
- Archived legacy stores are preserved for recovery/import but intentionally cannot be queried or mutated through MCP.
- `notes_get` can intentionally return a complete large note. List and search stay bounded and return previews, but clients must still budget for an explicitly requested large entity.
- Removing legacy tool aliases is an intentional V2 discovery change. Clients should refresh `tools/list` and use `system_capabilities_get` for the replacement map.
