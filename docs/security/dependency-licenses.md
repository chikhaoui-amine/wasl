# Dependency License Audit

This document provides a comprehensive legal and license audit of all direct runtime and development dependencies used in WASL (Core and `@wasl/mcp-local`).

---

## License Compatibility Overview

All direct dependencies in WASL are licensed under widely recognized, permissive open-source licenses (**MIT**, **Apache-2.0**, and **ISC**). These licenses explicitly permit non-commercial and source-available distribution, compilation, and bundling with appropriate copyright attributions preserved.

| Dependency | Version | License | Category | Notes / Compatibility |
|---|---|---|---|---|
| `@modelcontextprotocol/sdk` | 1.26.0 | MIT | Runtime | Official MCP SDK (MIT) |
| `@tailwindcss/postcss` | 4.3.2 | MIT | Build / CSS | Tailwind CSS PostCSS plugin (MIT) |
| `@tanstack/react-query` | 5.102.1 | MIT | Runtime | Async state synchronization (MIT) |
| `@testing-library/dom` | 10.4.1 | MIT | Testing | DOM testing utilities (MIT) |
| `@testing-library/react` | 16.3.2 | MIT | Testing | React testing utilities (MIT) |
| `@types/*` | 19.x / 20.x | MIT | Dev | TypeScript definitions (MIT) |
| `clsx` | 2.1.1 | MIT | Runtime | Class name utility (MIT) |
| `cmdk` | 1.1.1 | MIT | Runtime | Command palette component (MIT) |
| `dexie` | 4.4.5 | Apache-2.0 | Runtime | IndexedDB persistence library (Apache-2.0) |
| `eslint` & `eslint-config-next` | 9.x / 16.x | MIT | Dev | Linter & static analysis (MIT) |
| `fake-indexeddb` | 6.2.5 | Apache-2.0 | Testing | Test environment storage mock (Apache-2.0) |
| `framer-motion` | 12.42.2 | MIT | Runtime | Motion and animation library (MIT) |
| `jsdom` | 26.1.0 | MIT | Testing | Headless DOM simulator (MIT) |
| `lucide-react` | 1.23.0 | ISC | Runtime | UI icon set (ISC / Permissive) |
| `next` | 16.2.10 | MIT | Framework | Next.js App Router (MIT) |
| `react` & `react-dom` | 19.2.4 | MIT | Runtime | React UI framework (MIT) |
| `react-markdown` | 10.1.0 | MIT | Runtime | Markdown renderer (MIT) |
| `remark-breaks` & `remark-gfm` | 4.x | MIT | Runtime | Markdown formatting plugins (MIT) |
| `tailwind-merge` | 3.6.0 | MIT | Runtime | Tailwind utility merger (MIT) |
| `tailwindcss` | 4.3.2 | MIT | Build / CSS | Utility-first CSS framework (MIT) |
| `typescript` | 5.9.3 | Apache-2.0 | Build | TypeScript compiler (Apache-2.0) |
| `vitest` | 4.1.9 | MIT | Testing | Unit and integration test runner (MIT) |
| `ws` | 8.x | MIT | Runtime | WebSocket implementation (MIT) |
| `zod` | 3.x / 4.x | MIT | Runtime | Schema validation library (MIT) |

---

## Conclusion

None of WASL's dependencies impose viral copyleft restrictions (such as GPL/AGPL requirements) that would conflict with the **PolyForm Noncommercial License 1.0.0** model. All third-party notices and licenses are fully preserved in accordance with their respective terms.
