# WASL Local Development Guidelines

## Architecture

- **Two Workspaces & Repository Roles**:
  - **`wasl-local` (`/home/amine/wasl-local`)**: Public open-source repository (`https://github.com/chikhaoui-amine/wasl.git`). 100% offline, zero-auth, zero network credentials. Persistence is IndexedDB (`wasl-local`) via Dexie through `LocalAdapter`. ONLY `wasl-local` code is pushed to this GitHub repository.
  - **`wasl-cloud` (`/home/amine/wasl-cloud`)**: Cloud edition with Supabase Auth, Postgres snapshots, Cloud Sync, and OAuth.
- **Dual-Edition Development Rule**:
  - Whenever implementing features, UI enhancements, optimizations, or fixes: **ALWAYS implement in BOTH `wasl-local` and `wasl-cloud`**, keeping local vs cloud architectural boundaries strictly in mind.
- **Persistence**: All data is stored in the browser's IndexedDB (`wasl-local`) via Dexie through `LocalAdapter` (`lib/data/adapters/local/`).
- **Data layer**: Persistence goes through the `DataAdapter` interface (`lib/data/types.ts`). Components interact with domain hooks in `lib/data/domains/<domain>/hooks.ts`.
- **Store registry**: Active stores and schema versions live in `lib/data/store-registry.ts` (11 active stores).
- **Migrations**: Active stores register pure migration functions in `lib/data/migrations.ts` (`DOMAIN_MIGRATIONS`). Older snapshots migrate in memory on read.
- **Backups**: `.wasl-backup` canonical format with SHA-256 over sorted-key JSON (`lib/data/backup/`).
- **MCP**: Local STDIO connector package lives in `packages/wasl-mcp-local/` and communicates via authenticated loopback bridge with the local relay executor (`lib/relay/`).

## 1. MCP Integration
Whenever adding or modifying tools or features:
- Update tools in:
  1. `packages/wasl-mcp-local/src/tool-definitions.ts` (local STDIO tool list)
  2. `lib/relay/local-executor.ts` (local executor)
- Destructive tools MUST resolve id-or-title references via `requireUniqueMatch` — ambiguous references must error, never fan out across same-titled siblings.

## 2. Zero Data Loss & Storage Integrity
Whenever creating or modifying any store, schema, or persistence logic:
- **Migration Handlers**: Register a migration for any version bump in `lib/data/migrations.ts`. Migrations MUST be pure functions returning complete state.
- **Store Registry**: New persisted domains MUST be added to `STORE_REGISTRY` with a version number.
- **Validation Schemas**: Every store needs a strict Zod state schema in `lib/data/validation/domain-schemas.ts` that mirrors the RUNTIME shape.
- **Offline Safety**: Selective transfer merges must union day-keyed maps (`mergeDayKeyedMaps`) rather than clobbering shared days.

## Verification Commands
```bash
npm run lint          # eslint (0 errors expected)
npm run typecheck     # typecheck (tsc --noEmit)
npm test              # vitest test suite
npm run build         # production build
npm run build:mcp     # rebuild the STDIO connector package
```
