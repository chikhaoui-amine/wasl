<p align="center">
  <img src="docs/assets/wasl-banner.svg" alt="WASL — local-first personal workspace with MCP integration" width="100%" />
</p>

<p align="center">
  <strong>Your life, organized locally — and accessible to the AI tools you choose.</strong>
</p>

<p align="center">
  <a href="https://github.com/chikhaoui-amine/wasl/actions/workflows/ci.yml"><img src="https://github.com/chikhaoui-amine/wasl/actions/workflows/ci.yml/badge.svg" alt="CI status" /></a>
  <img src="https://img.shields.io/badge/data-local--first-111111" alt="Local-first" />
  <img src="https://img.shields.io/badge/MCP-local%20connector-111111" alt="Local MCP" />
  <img src="https://img.shields.io/badge/license-PolyForm%20Noncommercial-111111" alt="PolyForm Noncommercial license" />
</p>

<p align="center">
  <a href="#why-wasl">Why WASL</a> ·
  <a href="#features">Features</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#mcp--ai-connections">MCP</a> ·
  <a href="#privacy--data">Privacy</a> ·
  <a href="#documentation">Docs</a>
</p>

---

## What is WASL?

**WASL (وصل)** is a local-first personal workspace for tasks, goals, notes, habits, health, money, learning, journaling, and planning.

The important difference is not another dashboard. WASL exposes your system to compatible AI tools through a **permission-controlled local Model Context Protocol (MCP) connector**. Your AI can read or update the parts of WASL you explicitly allow, while your personal data remains on your device.

There are **no accounts, no remote database, no telemetry, and no required API keys** in WASL Local.

> The official hosted WASL Cloud product is maintained separately and is not part of this repository.

## Why WASL

| | WASL approach |
| --- | --- |
| **Own your data** | Personal data is stored in browser IndexedDB through Dexie. |
| **Work offline** | Core WASL functionality runs without an internet connection. |
| **Connect AI locally** | Claude Code, Codex, Claude Desktop, Cursor, and other compatible clients can connect through local MCP. |
| **Control access** | MCP connections have per-client secrets, read/read-write permissions, and domain-level access controls. |
| **Keep one system** | Tasks, goals, notes, habits, health, money, learning, journal, calendar, and recurring work live together. |
| **Move your data** | Full backups and selective transfers let you restore or migrate your workspace. |

## Features

### Personal workspace

- **Tasks** — subtasks, priorities, timeframes, daily focus, and goal linkage.
- **Goals** — North Stars, outcomes, challenges, milestones, and progress tracking.
- **Notes** — Markdown notes, tags, categories, colors, pinning, and search-friendly structure.
- **Calendar & time blocks** — plan days visually and connect scheduled work to the rest of WASL.
- **Journal** — day-based entries, mood tracking, reflections, and tags.
- **Habits** — frequencies, streaks, targets, and completion history.
- **Health** — workouts, exercises, programs, and health metrics.
- **Money** — income, expenses, categories, runway, and savings targets.
- **Learning** — topic roadmaps, steps, notes, and resource links.
- **Recurring tasks** — reusable recurring templates and cadence rules.
- **Trash & restore** — soft deletion across supported domains.

### MCP & AI connections

- Local STDIO MCP connector package: `@wasl/mcp-local`.
- Authenticated loopback communication over `127.0.0.1`.
- Separate connector profiles for different AI clients.
- Read-only or read-write access per connection.
- Domain-level permission controls, including sensitive-domain gating.
- Secret rotation, revocation, enable/disable controls, and local audit logs.

### PWA & offline

- Installable Progressive Web App.
- Offline application shell and local data access.
- No remote account is required to use the workspace.

### Design

WASL includes multiple curated themes, keyboard-driven navigation, quick capture, command search, and a responsive interface designed for daily use rather than setup-heavy configuration.

## Quick start

### Requirements

- **Node.js 20+**
- **npm 10+**

### Run locally

```bash
git clone https://github.com/chikhaoui-amine/wasl.git
cd wasl
npm install
npm run dev
```

Open **http://localhost:3000**.

No `.env` values, database setup, account, or API key is required.

### Production build

```bash
npm run build
npm run start
```

### Verify the project

```bash
npm run lint
npm run typecheck
npm test
npm run build:mcp
npm run build
```

## MCP & AI connections

WASL's local MCP connector lets compatible AI clients interact with the data in your active local WASL instance.

### 1. Start WASL

```bash
npm run dev
```

### 2. Build the connector

```bash
npm run build:mcp
```

### 3. Create a connection

In WASL, open **Settings → AI connections**. Create a connector profile for your client, choose its permissions and allowed domains, then use the configuration WASL generates for that profile.

### 4. Connect your AI client

Detailed setup examples for **Codex, Claude Code, Claude Desktop, and Cursor** are in the [MCP setup guide](docs/guides/mcp-setup.md).

> The browser/PWA instance must be running for the local MCP bridge to access its IndexedDB data. WASL Local does not become an always-online server when your computer is off.

## Privacy & data

WASL Local is designed around a simple boundary: **your workspace data stays on your device**.

- Personal data is persisted in the browser's **IndexedDB** database (`wasl-local`) through Dexie.
- WASL Local has **no analytics or telemetry**.
- Normal local operation makes **no outbound application data requests**.
- MCP communication stays on the local loopback interface (`127.0.0.1`) and requires connector authentication.
- The repository requires no Cloud credentials or Supabase configuration.

For the threat model and trust boundaries, read the [security model](docs/security/security-model.md).

### Important storage note

Browser storage is tied to the browser profile and origin you use. Clearing site data, using another browser/profile, changing how you host WASL, or resetting browser storage can make the local database unavailable.

**Export backups regularly.**

## Backup, export & import

Go to **Settings → Backup & transfer**.

- **Full backup** exports a `.wasl-backup` containing supported local domains.
- **Import backup** restores a compatible WASL backup.
- **Selective transfer** exports chosen domains/entities as `.wasl-transfer` for controlled migration or merging.

See the [backup & recovery guide](docs/guides/backup-recovery.md) before moving or clearing browser data.

## Project structure

```text
app/                       Next.js routes
components/                UI and feature components
lib/data/                  local data layer, domains, validation, migrations
lib/relay/                 local MCP bridge, permissions, presets, audit
packages/wasl-mcp-local/   STDIO MCP connector package
public/                    PWA assets, icons, service worker
docs/                      architecture, setup, security documentation
tests/                     unit, integration, and end-to-end verification
```

## Documentation

- [Data architecture](docs/architecture/data-architecture.md)
- [Local MCP architecture](docs/architecture/local-live-mcp.md)
- [Design system](docs/architecture/design-system.md)
- [MCP setup](docs/guides/mcp-setup.md)
- [Backup & recovery](docs/guides/backup-recovery.md)
- [Security model](docs/security/security-model.md)
- [Dependency licenses](docs/security/dependency-licenses.md)
- [Security policy](SECURITY.md)
- [Contributing](CONTRIBUTING.md)

## Contributing

Bug reports and improvements are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

If your change touches persistence, migrations, backups, or MCP tools, also read [AGENTS.md](AGENTS.md) for the invariants that protect user data and connector behavior.

## License

WASL is **source-available for personal, educational, and other non-commercial use** under the [PolyForm Noncommercial License 1.0.0](LICENSE).

Commercial use, commercial hosting, resale, or integration into a paid commercial product requires separate permission from the maintainer.

The WASL name, logo, and brand assets are covered separately by [TRADEMARKS.md](TRADEMARKS.md).
