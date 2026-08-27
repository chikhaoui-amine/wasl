# WASL Local Live MCP Architecture

## Overview

The WASL Local MCP Architecture provides a single, direct mode for AI assistants to interact with WASL Local Edition:

1. **Direct Local MCP (`packages/wasl-mcp-local`)**: An official Model Context Protocol server communicating over standard I/O (STDIO) with local desktop tools (Antigravity, Claude Code, Cursor, Hermes, OpenClaw, Codex, Windsurf, VS Code, Zed, Continue, Cline / Roo, Generic STDIO) and bridging to the local browser PWA via an authenticated loopback WebSocket on `127.0.0.1`. The connector secret is mandatory; the bridge refuses unauthenticated connections.

> Cloud AI clients (e.g. claude.ai) connect to the CLOUD edition's MCP server at `/api/mcp` via OAuth 2.1 — see docs/security/security-model.md. The former experimental Web Relay was removed.
Both modes execute operations purely through the framework-independent **`LocalMcpExecutor`** directly against IndexedDB/Dexie via `LocalAdapter`. User data never leaves the local machine.

> **Local PWA Dependency**: Direct Local STDIO connections work exclusively while the WASL Local PWA is open in your browser. Closing the window immediately severs the loopback bridge and returns `WASL_LOCAL_OFFLINE`.

---

## 1. Direct Local MCP Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│ Desktop AI Client (Antigravity / Cursor / Hermes / Claude Code / etc.) │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ STDIO (JSON-RPC 2.0)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ packages/wasl-mcp-local (Node.js CLI process)                          │
│ - Official @modelcontextprotocol/sdk Server                            │
│ - Exposes all 12 WASL store tools                                      │
│ - Runs Loopback WebSocket Bridge on 127.0.0.1:<port>                   │
│ - Each connector profile gets its own dynamically allocated port       │
│ - Exits cleanly when STDIO closes                                      │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Authenticated Loopback WS (127.0.0.1:<port>)
                                   │ Handshake: { "type": "auth", "secret": "..." }
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ WASL Local PWA (Browser / IndexedDB)                                   │
│ - useMultiLoopbackSocket Hook                                          │
│ - LocalMcpExecutor (11 domains + trash + idempotency)                  │
│ - Client Permissions (Read vs Read+Write)                              │
│ - Per-Domain Gating (every domain gated by profile allowlist)          │
│ - Local Audit Logging                                                  │
│ - Dexie / IndexedDB Persistence                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Universal Connector-Profile System

WASL uses a dynamic connector-profile architecture rather than fixed hardcoded tabs:
- **Dynamic Port Range (`42424–42499`)**: Ports are allocated on demand from available loopback ports. No permanent port is hardcoded to any product name.
- **Unique 256-bit Secrets**: Each connection has its own cryptographic key (`wasl_sec_<id>_<randomHex>`), rotatable on demand.
- **Multi-Instance Support**: Run multiple simultaneous connections for the same client (e.g. "Cursor Work" on port 42424 and "Cursor Personal" on port 42425).
- **Universal STDIO Bridge**: All presets utilize the identical `packages/wasl-mcp-local` bridge and share the canonical `LocalMcpExecutor`.

### Preset Configuration Catalog

WASL provides built-in presets that generate exact copy-ready configurations:

| Preset | Category | Configuration Format |
|---|---|---|
| **Antigravity IDE & CLI** | IDE / Editor | `mcpServers` JSON for `~/.gemini/antigravity-ide/mcp_config.json` + `agy mcp add` CLI command |
| **Hermes Agent** | Autonomous Agent | `mcp_servers` YAML (`~/.hermes/config.yaml`) + JSON snippet |
| **OpenClaw** | Autonomous Agent | `mcp.servers` JSON with required `bundle-mcp` sandbox permissions note |
| **Claude Code** | Terminal / CLI | `claude mcp add` CLI command + `.mcp.json` |
| **Claude Desktop** | IDE / Editor | `claude_desktop_config.json` |
| **Codex CLI** | Terminal / CLI | `codex mcp add` CLI command + `~/.codex/config.json` |
| **Cursor** | IDE / Editor | `~/.cursor/mcp.json` + Command UI setup |
| **Windsurf** | IDE / Editor | `~/.codeium/windsurf/mcp_config.json` |
| **VS Code** | IDE / Editor | `.vscode/mcp.json` |
| **Zed** | IDE / Editor | `context_servers` JSON for `settings.json` |
| **Continue** | IDE / Editor | `~/.continue/config.json` |
| **Cline / Roo Code** | IDE / Editor | `cline_mcp_settings.json` / `roo_mcp_settings.json` |
| **Generic STDIO** | Custom / Protocol | Universal JSON + Raw CLI command |
| **Custom Client** | Custom / Protocol | Configurable transport (STDIO, Streamable HTTP) |

### Origin Enforcement Policy (Loopback Bridge)

The loopback WebSocket bridge validates the `Origin` header in the following precedence order:
1. **Loopback origins** (`localhost`, `127.0.0.1`, `::1` over `http:` or `https:`) — always allowed.
2. **Custom URI schemes** (`app:`, `wasl:`, `vscode-webview:`, `chrome-extension:`) — allowed.
3. **Exact allowlist via `WASL_ALLOWED_ORIGINS` env var** — comma-separated, exact, case-insensitive.
4. **Missing, empty, or foreign Origin** — rejected prior to secret authentication.

---


## 3. Shared Browser Executor (`LocalMcpExecutor`)

The `LocalMcpExecutor` in `lib/relay/local-executor.ts` is framework-independent and guarantees:
- **Full Coverage**: Handles all 11 active persisted stores (`lifeos-tasks`, `lifeos-notes`, `lifeos-goals`, `lifeos-habits`, `lifeos-blocks`, `lifeos-journal`, `lifeos-money`, `lifeos-health`, `lifeos-recurring`, `lifeos-topics`, `lifeos-trash`) plus unified `search_all`.
- **Safe Soft Deletions**: Deleting any item moves it to `lifeos-trash` with metadata for non-destructive restore.
- **Write Idempotency**: Caches write responses by `idempotencyKey` in a sliding LRU cache to prevent duplicated entries during network retries.
- **Defensive Pagination**: Standardises result limits (max 50) and cursor offsets.
- **Client Permissions**:
  - `permission: "read"` blocks any write/mutation tools.
  - `allowedDomains`: Per-domain gating; sensitive domains (`journal`, `money`, `health`) are opt-in and disabled by default.
- **Local Audit Log**: Stores execution history (client ID, client name, tool, domain, outcome, latency) in `localStorage` under `wasl_mcp_audit_log`.

---

## 4. Settings Experience

Under **Settings → AI & MCP Settings**, users can:
- Enable/disable Direct Local AI Connector.
- Add new connector profiles from 13+ presets or custom protocol settings.
- Rename, enable, disable, or revoke individual connection profiles.
- View and rotate the per-client 256-bit Connector Secret.
- Copy one-click configuration snippets tailored for their client of choice.
- Manage client access permissions (Read vs Read+Write) and toggle per-domain access (`Journal`, `Money`, `Health` are opt-in).
- Inspect real-time audit logs of all AI tool executions with client filtering and latency metrics.

---

## 5. Security & Verification Summary

