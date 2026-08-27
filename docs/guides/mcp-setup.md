# Model Context Protocol (MCP) Setup Guide

WASL provides native **Model Context Protocol (MCP)** integration, enabling AI assistants (Codex, Claude Code, Claude Desktop, Cursor) to interact with your personal notes, tasks, goals, habits, and journal.

---

## 1. Local Direct MCP (STDIO Bridge)

The Local MCP package (`packages/wasl-mcp-local`) runs as a local STDIO process connecting directly to your active WASL browser tab via local loopback.

### Step 1: Build the Package
From the root of your cloned repository:
```bash
npm run build:mcp
```

### Step 2: Retrieve Your Connector Secret
1. Open WASL on `http://localhost:3000`.
2. Go to **Settings → Local Storage & Connector**.
3. Under the **Local MCP Connector** panel, find your **Connector Secret**.

---

## 2. Client Configurations

### Codex CLI
In `~/.codex/config.json`:
```json
{
  "mcpServers": {
    "wasl": {
      "command": "node",
      "args": [
        "<PATH_TO_WASL_REPO>/packages/wasl-mcp-local/dist/cli.js",
        "--secret=YOUR_CONNECTOR_SECRET"
      ]
    }
  }
}
```

### Claude Code
Run:
```bash
claude mcp add wasl node <PATH_TO_WASL_REPO>/packages/wasl-mcp-local/dist/cli.js --secret=YOUR_CONNECTOR_SECRET
```

### Claude Desktop
Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "wasl-local": {
      "command": "node",
      "args": [
        "<PATH_TO_WASL_REPO>/packages/wasl-mcp-local/dist/cli.js",
        "--secret=YOUR_CONNECTOR_SECRET"
      ]
    }
  }
}
```

### Cursor
1. Go to **Cursor Settings → Features → MCP Servers**.
2. Click **+ Add New MCP Server**.
3. Set **Type**: `stdio`
4. Set **Command**: `node <PATH_TO_WASL_REPO>/packages/wasl-mcp-local/dist/cli.js --secret=YOUR_CONNECTOR_SECRET`

---
