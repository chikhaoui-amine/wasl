# WASL Security Model

WASL is architected with strict security boundaries, on-device data isolation, and privacy-first principles.

---

## 1. Local Security Boundary

- **Air-Gapped Local Operation**: WASL Local executes 100% inside the client browser. No data, telemetry, analytics, or error traces are ever transmitted over external networks.
- **On-Device Storage**: IndexedDB is sandboxed by the browser per-origin (`http://localhost:3000` or custom local domain).
- **Direct MCP Connector**: Uses local loopback (`127.0.0.1`) secured by a local secret handshake and origin validation.

---

## 2. Local MCP Hardening

- **Consent & Permissions**: Local MCP tool calls are gated per domain preset (read-only, read-write, custom).
- **Strict Entity Resolution**: Destructive tools resolve id-or-title references via unique matching; ambiguous references are refused rather than fanning out across siblings.
- **Constant-Time Comparisons**: Connector secrets and loopback tokens are compared using timing-safe primitives.

---

## 3. Known Trust Boundaries

- **Local connector secrets** live in browser localStorage so the PWA can authenticate to the loopback bridge automatically. WASL mitigates risks with a strict dependency surface, no third-party tracking scripts, and WebCrypto-generated secrets.

---

## 4. Responsible Disclosure

For reporting vulnerabilities, see [`SECURITY.md`](../../SECURITY.md).
