# WASL Local MCP Architecture

## Overview

WASL Local exposes a single MCP path for compatible AI clients:

```text
AI client
   │
   │ STDIO / JSON-RPC
   ▼
wasl-mcp-local
   │
   │ authenticated loopback WebSocket
   │ 127.0.0.1:<profile-port>
   ▼
WASL browser / PWA
   │
   ▼
LocalMcpExecutor
   │
   ▼
LocalAdapter → Dexie → IndexedDB
```

The connector runs on the user's computer. Personal WASL data remains in the browser's local IndexedDB database and is accessed through the same Local data adapter used by the application.

The WASL browser/PWA instance must be running for MCP requests to succeed. Closing it removes the browser-side bridge, so the local connector cannot access WASL data while the computer or application is offline.

## Connector process

The Node.js connector lives in `packages/wasl-mcp-local/`.

It:

- exposes WASL MCP tools through the official `@modelcontextprotocol/sdk`;
- communicates with MCP clients over STDIO;
- bridges requests to the active WASL browser/PWA instance through loopback only;
- uses a dynamically allocated local port per connector profile;
- requires a profile-specific connector secret;
- exits cleanly when its STDIO client disconnects.

Build it from the repository root with:

```bash
npm run build:mcp
```

## Browser-side executor

`LocalMcpExecutor` in `lib/relay/local-executor.ts` handles MCP operations against the Local data layer.

Important properties:

- MCP operations use `LocalAdapter`; there is no remote database dependency.
- Read and write operations share the application's normal validation and persistence boundaries.
- Destructive operations use safe entity resolution and refuse ambiguous matches.
- Writes support idempotency protection to reduce accidental duplicate mutations.
- Results are bounded/paginated where appropriate.
- Deletion uses WASL's normal soft-delete/trash behavior where supported.

## Connector profiles

WASL uses independent connector profiles instead of one global AI credential.

Each profile can have:

- its own generated secret;
- its own local port;
- read-only or read-write permission;
- an allowlist of accessible WASL domains;
- enable/disable and revocation state;
- a local audit trail.

Sensitive domains such as journal, money, and health can be gated separately rather than automatically exposed to every connection.

Profiles and copy-ready client configurations are managed in **Settings → AI connections**.

## Supported client patterns

The UI contains presets for multiple MCP-capable clients and also supports custom connections. Presets generate configuration using the same local connector architecture rather than separate per-client backends.

Examples include:

- Claude Code
- Claude Desktop
- Codex
- Cursor
- VS Code
- Windsurf
- Zed
- Continue
- Cline / Roo Code
- other compatible STDIO clients

See [MCP setup](../guides/mcp-setup.md) for user-facing configuration instructions.

## Loopback boundary

The browser-side bridge accepts local connections only and validates connection origin before connector-secret authentication.

Loopback origins such as `localhost`, `127.0.0.1`, and `::1` are supported. Approved custom application schemes and explicitly configured local origins may also be accepted by the implementation where needed for compatible clients.

A connector secret should be treated like a local credential. Users can rotate or revoke it from **Settings → AI connections**.

## Permission enforcement

MCP authorization is enforced per connector profile:

- `read` profiles cannot execute mutation tools;
- `read_write` profiles can mutate only permitted domains;
- domain access is checked for every tool invocation;
- destructive operations do not bypass normal entity-resolution safeguards.

The connector's local audit log records relevant execution metadata such as client/profile, tool, domain, outcome, and latency. It is stored locally and is not remote telemetry.

## Trust boundary

WASL Local's MCP design protects the boundary between a local AI client and the browser-hosted personal database; it does not make an untrusted local machine safe.

A process with sufficient access to the user's machine or browser profile may already be able to access local files, browser state, or connector configuration. Users should therefore connect only AI clients they trust and grant the minimum domains/permissions they need.

For the broader threat model, see [Security model](../security/security-model.md).
