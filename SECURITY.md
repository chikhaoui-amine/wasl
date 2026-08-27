# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

The WASL maintainers take security seriously. If you discover a security vulnerability or privacy issue in WASL, please report it responsibly.

### How to Report
- **Do not open a public GitHub issue** for sensitive security vulnerabilities.
- Please report vulnerabilities privately via GitHub Security Advisories or by contacting the maintainer directly.
- Include detailed steps to reproduce the issue, proof-of-concept payloads (if applicable), and your assessment of the impact.

---

## Security Architecture

- **Local-First & Offline**:
  - Operates completely offline with zero telemetry, zero analytics, and zero external network calls.
  - All data is stored locally in the browser's IndexedDB via Dexie.
  - Direct STDIO MCP connector operates over an authenticated loopback TCP WebSocket on `127.0.0.1` (mandatory connector secret, timing-safe comparison, strict origin validation).
