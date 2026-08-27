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
  <a href="#install-as-an-app-pwa">Install as App</a> ·
  <a href="#why-wasl">Why WASL</a> ·
  <a href="#what-you-get">Features</a> ·
  <a href="#ai-that-can-work-with-your-system">MCP</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#your-data-stays-yours">Privacy</a> ·
  <a href="#documentation">Docs</a>
</p>

---

## Install as an App (PWA)

WASL is an installable Progressive Web App (PWA) that runs offline with native-like performance on Desktop, iPhone, iPad, and Android:

| Device / Platform | How to Install |
| --- | --- |
| **Desktop**<br>*(Chrome, Edge, Brave, Arc)* | Open WASL in your browser → Click the **Install** icon in the address bar (or browser menu `⋮` → **Install WASL**). Launches in a dedicated, borderless window with a desktop/dock shortcut. |
| **iOS / iPadOS**<br>*(Safari)* | Open WASL in Safari → Tap the **Share** button (box with upward arrow) → Scroll down and tap **"Add to Home Screen"** → Tap **Add**. |
| **Android**<br>*(Chrome)* | Open WASL in Chrome → Tap `⋮` (menu) in the top-right corner → Tap **"Install app"** or **"Add to Home screen"**. |

Once installed, WASL runs standalone with zero network latency, persistent offline caching, and instant launch from your home screen or application launcher.

---

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

Each connection can have its own secret, read/read-write permission, and allowed domains. Sensitive domains such as journal, money and health are gated separately.

MCP traffic stays on the loopback interface (`127.0.0.1`). The WASL browser/PWA instance must be running because the connector works with the active local IndexedDB workspace.

Detailed configuration examples are in the [MCP setup guide](docs/guides/mcp-setup.md).

## Quick start

### Requirements

- **Node.js 20+**
- **npm 10+**

```bash
git clone https://github.com/chikhaoui-amine/wasl.git
cd wasl
npm install
npm run dev
```

Open **http://localhost:3000**.

That's it. WASL Local requires no `.env`, Supabase project, account, remote database or API key.

### Production build

```bash
npm run build
npm run start
```

### Build the local MCP connector

```bash
npm run build:mcp
```

Then open **Settings → AI connections** inside WASL and create a connector profile for the AI client you want to use.

## Your data stays yours

WASL Local is deliberately built without a required hosted backend.

```text
AI client
    │
    │ STDIO / MCP
    ▼
wasl-mcp-local
    │
    │ authenticated 127.0.0.1 WebSocket
    ▼
WASL in your browser / PWA
    │
    ▼
IndexedDB (Dexie)
```

- **No accounts** for Local.
- **No telemetry or analytics.**
- **No remote database dependency.**
- **No Cloud credentials required.**
- Personal workspace data is persisted in the browser's IndexedDB database.
- MCP access is authenticated and permission-controlled per connection.

Read the [security model](docs/security/security-model.md) for the detailed trust boundaries.

### One important trade-off

Local ownership means **you are responsible for your local data**.

Browser storage belongs to a particular browser profile and origin. Clearing site data, changing browser/profile, or moving WASL incorrectly can make that database unavailable.

Use **Settings → Backup & transfer** regularly:

- `.wasl-backup` — complete validated backup;
- `.wasl-transfer` — selective domain/entity transfer and merge.

Read the [backup & recovery guide](docs/guides/backup-recovery.md) before clearing or moving browser data.

## Tech

`Next.js 16` · `React 19` · `TypeScript` · `Tailwind CSS v4` · `Dexie / IndexedDB` · `TanStack Query` · `MCP SDK` · `Vitest`

```text
app/                       Next.js routes
components/                product UI and feature components
lib/data/                  local persistence, domains, migrations, validation
lib/relay/                 local MCP execution, permissions, audit, presets
packages/wasl-mcp-local/   STDIO MCP connector
public/                    PWA assets and service worker
docs/                      architecture, setup and security docs
tests/                     unit, integration and E2E verification
```

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build:mcp
npm run build
```

The repository also includes E2E coverage for the local MCP bridge, HTTPS loopback boundary and PWA behavior.

## Documentation

- [MCP setup](docs/guides/mcp-setup.md)
- [Local MCP architecture](docs/architecture/local-live-mcp.md)
- [Data architecture](docs/architecture/data-architecture.md)
- [Backup & recovery](docs/guides/backup-recovery.md)
- [Security model](docs/security/security-model.md)
- [Design system](docs/architecture/design-system.md)
- [Contributing](CONTRIBUTING.md)

## Contributing

Bug reports, fixes and thoughtful improvements are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

If you touch persistence, migrations, backups or MCP behavior, also read [AGENTS.md](AGENTS.md) — those parts have stricter invariants because mistakes can affect user data or connector permissions.

## License

WASL is **source-available for personal, educational and other non-commercial use** under the [PolyForm Noncommercial License 1.0.0](LICENSE).

Commercial use or commercial hosting requires separate permission from the maintainer.

The WASL name, logo and official brand assets are governed separately by [TRADEMARKS.md](TRADEMARKS.md).
