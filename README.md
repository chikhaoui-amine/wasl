<p align="center">
  <img src="docs/assets/wasl-banner.webp" alt="WASL" width="100%" />
</p>

<p align="center">
  <strong>A local-first personal workspace that your AI can actually work with.</strong>
</p>

<p align="center">
  Organize your tasks, goals, notes, habits, health, money, learning and journal — then connect compatible AI tools through a permission-controlled local MCP bridge.
</p>

<p align="center">
  <a href="https://github.com/chikhaoui-amine/wasl/actions/workflows/ci.yml"><img src="https://github.com/chikhaoui-amine/wasl/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/data-local--first-111111" alt="Local-first" />
  <img src="https://img.shields.io/badge/MCP-local-111111" alt="Local MCP" />
  <img src="https://img.shields.io/badge/telemetry-none-111111" alt="No telemetry" />
  <img src="https://img.shields.io/badge/license-PolyForm%20Noncommercial-111111" alt="PolyForm Noncommercial" />
</p>

<p align="center">
  <a href="#why-wasl">Why WASL</a> ·
  <a href="#what-you-get">Features</a> ·
  <a href="#ai-that-can-work-with-your-system">MCP</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#your-data-stays-yours">Privacy</a> ·
  <a href="#documentation">Docs</a>
</p>

---

<p align="center">
  <img src="docs/assets/wasl-home.webp" alt="WASL home dashboard" width="100%" />
</p>

## Why WASL

Most productivity apps stop at storing information. WASL is built around a different idea: **your personal system should be structured, local, and usable by the AI tools you choose.**

You keep one workspace for the important parts of your life, while compatible AI clients can read or update only the domains you explicitly allow through local MCP.

There is no account to create, no remote database to configure, no telemetry, and no API key required to run WASL Local.

> The hosted WASL Cloud product is maintained separately and is not part of this repository.

## What you get

| | |
| --- | --- |
| **Plan & execute** | Tasks, subtasks, priorities, daily focus, goals, milestones, recurring work and calendar time blocks. |
| **Build a second brain** | Markdown notes, categories, learning topics, roadmaps and resources. |
| **Track yourself** | Habits, journal entries, workouts, health metrics, money and savings targets. |
| **Connect AI locally** | MCP profiles for compatible clients with read/read-write and domain-level permissions. |
| **Own the data** | IndexedDB persistence, full backups, selective transfers and no required hosted backend. |
| **Use it like an app** | Installable PWA, offline application shell, themes, quick capture and keyboard-driven navigation. |

### The workspace

WASL currently includes:

`Home` · `Goals` · `Tasks` · `Calendar` · `Notes` · `Learning` · `Journal` · `Habits` · `Health` · `Money` · `Settings`

Behind the UI, persisted data is split into versioned domain stores with validation, migrations, backup support and soft-delete recovery.

## AI that can work with your system

This is the part that makes WASL different.

WASL includes a **local Model Context Protocol connector**. A compatible AI client can interact with your active WASL workspace instead of relying on copy-paste or isolated chat context.

For example, an AI client can:

- read your tasks before helping plan the day;
- create or update a note while you research;
- inspect goals before suggesting next actions;
- add tasks generated from a coding or planning session;
- search across allowed WASL domains;
- work read-only when you do not want it changing anything.

### Permission model

Each connector profile has its own local secret and can be configured with:

- **Read-only** or **read + write** access;
- domain-level allowlists;
- opt-in access for sensitive domains;
- secret rotation and revocation;
- local audit logs.

The bridge runs on the loopback interface (`127.0.0.1`). Your browser/PWA instance must be running for the local connector to reach its IndexedDB data.

Detailed setup: **[MCP setup guide](docs/guides/mcp-setup.md)**.

## Quick start

### Requirements

- Node.js 20+
- npm 10+

### Run WASL

```bash
git clone https://github.com/chikhaoui-amine/wasl.git
cd wasl
npm install
npm run dev
```

Open **http://localhost:3000**.

That is it. No `.env`, account, database setup or API key is required.

### Production build

```bash
npm run build
npm run start
```

### Build the local MCP connector

```bash
npm run build:mcp
```

Then open **Settings → AI connections** inside WASL and create a connector profile for your client.

## Your data stays yours

WASL Local stores workspace data in your browser's **IndexedDB** database through Dexie.

- no analytics;
- no telemetry;
- no remote account;
- no Supabase or Cloud credentials;
- no required outbound application-data requests during normal local use;
- MCP traffic stays on local loopback.

### Backups matter

Local-first does not mean indestructible. Browser data is tied to the browser profile and origin you use. Clearing site data, resetting the browser profile, or changing how you host WASL can make that local database unavailable.

Use **Settings → Backup & transfer** to export `.wasl-backup` files regularly.

WASL also supports selective `.wasl-transfer` packages when you want to move only specific domains or entities.

Read **[Backup & recovery](docs/guides/backup-recovery.md)** before clearing or moving local data.

## How it is built

```text
AI client
   │
   │ MCP / STDIO
   ▼
wasl-mcp-local
   │
   │ authenticated loopback WebSocket
   ▼
WASL browser / PWA
   │
   ▼
LocalMcpExecutor
   │
   ▼
LocalAdapter → Dexie → IndexedDB
```

The UI talks to domain hooks through a local data adapter. Persisted stores are schema-versioned, validated and migration-aware, while backup/transfer formats provide a separate portability layer.

### Stack

**Next.js 16** · **React 19** · **TypeScript** · **Tailwind CSS v4** · **TanStack Query** · **Dexie / IndexedDB** · **Zod** · **Model Context Protocol SDK**

## Project structure

```text
app/                       Next.js routes
components/                UI and feature components
lib/data/                  local data layer, domains, validation, migrations
lib/relay/                 local MCP bridge, permissions, presets, audit
packages/wasl-mcp-local/   STDIO MCP connector
public/                    PWA assets, icons, service worker
docs/                      architecture, setup and security docs
tests/                     unit, integration and end-to-end verification
```

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build:mcp
npm run build
```

CI runs the same core verification on pushes and pull requests.

## Documentation

- [Data architecture](docs/architecture/data-architecture.md)
- [Local MCP architecture](docs/architecture/local-live-mcp.md)
- [MCP setup](docs/guides/mcp-setup.md)
- [Backup & recovery](docs/guides/backup-recovery.md)
- [Security model](docs/security/security-model.md)
- [Design system](docs/architecture/design-system.md)
- [Security policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)

## Contributing

Bug reports and focused improvements are welcome. Read **[CONTRIBUTING.md](CONTRIBUTING.md)** before opening a pull request.

Changes touching persistence, migrations, backups or MCP should also follow the invariants in **[AGENTS.md](AGENTS.md)**.

## License

WASL is **source-available for personal, educational and other non-commercial use** under the [PolyForm Noncommercial License 1.0.0](LICENSE).

Commercial use, commercial hosting, resale or integration into a paid commercial product requires separate permission from the maintainer.

The WASL name, logo and official brand assets are governed separately by [TRADEMARKS.md](TRADEMARKS.md).
