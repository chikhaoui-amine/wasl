# Direct Dependency License Reference

This document is a maintenance reference for the direct dependencies used by WASL Local and the `wasl-mcp-local` connector package. Package manifests and lockfiles are the source of truth for exact installed versions. Re-check dependency licenses whenever dependencies are added or upgraded.

This document is not legal advice.

## Current direct dependencies

| Dependency | License family | Role |
| --- | --- | --- |
| `@modelcontextprotocol/sdk` | MIT | MCP runtime |
| `@tanstack/react-query` | MIT | Query/state layer |
| `clsx` | MIT | UI utility |
| `cmdk` | MIT | Command palette |
| `dexie` | Apache-2.0 | IndexedDB persistence |
| `framer-motion` | MIT | Motion/animation |
| `lucide-react` | ISC | Icons |
| `next` | MIT | Application framework |
| `react`, `react-dom` | MIT | UI runtime |
| `react-markdown` | MIT | Markdown rendering |
| `remark-breaks`, `remark-gfm` | MIT | Markdown plugins |
| `tailwind-merge` | MIT | CSS utility merging |
| `ws` | MIT | Local MCP WebSocket transport |
| `zod` | MIT | Runtime validation |

## Direct development dependencies

The repository also uses development and testing packages including TypeScript, ESLint, Tailwind CSS, Testing Library, jsdom, fake-indexeddb, Vitest, and TypeScript type packages. These are distributed under permissive licenses such as MIT or Apache-2.0 at the versions currently declared by the project.

## Compatibility note

The direct dependencies currently used by WASL are permissively licensed and do not introduce a GPL/AGPL-style copyleft requirement into the WASL source distribution. Their own copyright notices and license terms still apply independently.

Before a public release after dependency changes:

1. review `package.json`, `packages/wasl-mcp-local/package.json`, and `package-lock.json`;
2. verify the licenses of any new direct dependencies;
3. preserve any notices required by those dependencies;
4. update this reference if the direct dependency set changes.
