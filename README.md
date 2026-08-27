# WASL (وصل)

<p align="center">
  <img src="public/logo.svg" alt="WASL Logo" width="80" height="80" />
</p>

<p align="center">
  <strong>A calm, local-first personal command center for goals, tasks, knowledge, habits, and AI tools.</strong>
</p>

<p align="center">
  <em>Open-source for personal and non-commercial use under the PolyForm Noncommercial License 1.0.0.</em>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#mcp-ai-integration">MCP AI Integration</a> •
  <a href="#data-storage--privacy">Privacy</a> •
  <a href="#backup--export">Backup & Export</a> •
  <a href="#pwa--offline">PWA & Offline</a> •
  <a href="#license">License</a>
</p>

---

## Overview

**WASL** (meaning *connection* / *continuity*) is a local-first personal management system and life OS built with **Next.js 16**, **React 19**, **Tailwind CSS v4**, and **Dexie (IndexedDB)**.

All your data is stored directly in your browser with zero remote database requirement, zero accounts, and zero telemetry. It features bidirectional **Model Context Protocol (MCP)** integration so local AI tools (such as Claude Code, Codex, Cursor, and Claude Desktop) can read and update your personal system with granular permission controls.

> An official hosted WASL Cloud edition is maintained separately.

---

## Features

### 🎯 Core Modules

- **Tasks**: Active tasks, subtasks, priorities, timeframes, and daily focus pinning.
- **Goals**: Multi-horizon goals (North Stars, Outcomes, Challenges) with milestones and progress indicators.
- **Notes**: Second-brain note taking with tags, categories, pinned notes, and Markdown preview.
- **Time Blocks**: Visual schedule planner with time-blocking grids and calendar view.
- **Journal**: Daily timeline entries with mood ratings, reflections, and tags.
- **Habits**: Daily habit tracker with streak counts, frequency targets, and weekly completion heatmaps.
- **Health**: Workout logging, custom exercises, training programs, and health metrics.
- **Money**: Income/expense tracking, categorization, monthly runway, and savings targets.
- **Learning Topics**: Step-by-step topic roadmaps, substeps, notes, and resource links.
- **Recurring Tasks**: Template-based recurring tasks with custom cadences.
- **Trash**: Soft-deletion repository with instant one-click restoration across all modules.

### 🤖 Model Context Protocol (MCP)

- **Local MCP Server**: Connect local AI agents (Claude Code, Codex, Cursor, Claude Desktop) directly to your local WASL data.
- **Real-Time Loopback Bridge**: Secure local WebSocket relay with token authentication.
- **Permission Presets**: Configurable permission profiles (Read-Only, Assistant, Manager, Full Access).

### 🎨 Themes & Design

- **"Depth & Glass" Design System**: Polished aesthetic with fluid animations, glassmorphism, and keyboard shortcuts (`Cmd/Ctrl + K` command palette, `C` quick capture).
- **Themes**: Switch between multiple curated themes including *Midnight Obsidian Glass*, *Editorial Porcelain*, and *Warm Desert Luxe*.

### 📱 PWA & Offline

- **Installable PWA**: Install WASL as a standalone desktop or mobile progressive web app.
- **100% Offline**: Operates fully offline without network connectivity.

---

## Quick Start

### Prerequisites

- **Node.js**: v20 or higher
- **npm**: v10 or higher

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/chikhaoui-amine/wasl.git
cd wasl

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. WASL is immediately ready — no accounts, database setup, or API keys required.

### Production Build

```bash
# Build the production application
npm run build

# Start the production server
npm run start
```

---

## MCP (Model Context Protocol) Integration

WASL includes a built-in local MCP connector package (`@wasl/mcp-local`) that allows AI coding tools and desktop assistants to interact with your data.

### 1. Build the MCP package

```bash
npm run build:mcp
```

### 2. Configure Your AI Client

#### Claude Desktop

Add the following to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "wasl": {
      "command": "node",
      "args": ["/path/to/wasl/packages/wasl-mcp-local/dist/cli.js"]
    }
  }
}
```

#### Claude Code / Codex

Configure the MCP server in your client settings or run:

```bash
npm run mcp:local
```

In the WASL settings UI under **AI Connections**, you can configure connector tokens and permissions.

---

## Data Storage & Privacy

- **On-Device Storage**: All personal data is persisted in your browser's local **IndexedDB** database (`wasl-local`) via Dexie.js.
- **Zero Telemetry**: WASL Local makes **no external network calls**, sends no analytics, and tracks no user behavior.
- **Loopback Isolation**: The local MCP connector communicates strictly over `127.0.0.1` with authentication.

---

## Backup, Export & Import

Because data lives in browser storage, clearing your browser history or site data can delete your local database. Regular backups are strongly recommended:

1. Open **Settings → Backup & transfer**.
2. Click **Export Backup** to download a `.wasl-backup` file.
3. To restore or move data to a new device, click **Import Backup** and select your file.
4. WASL also supports **Selective Transfer** (`.wasl-transfer`) to export and merge specific domains or entities.

---

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE).

- **Personal & Non-Commercial Use**: Free to use, modify, and run for personal, educational, and non-commercial purposes.
- **Commercial Use**: Commercial use, SaaS hosting, resale, or integration into paid commercial products requires written permission from the maintainer.

Brand names, trademarks, and logos remain protected under [TRADEMARKS.md](TRADEMARKS.md).
