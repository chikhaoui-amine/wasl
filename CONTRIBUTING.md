# Contributing to WASL

Thanks for helping improve WASL Local.

WASL stores personal data locally and exposes controlled access through MCP, so changes to persistence, migrations, backups, permissions, and destructive tools require extra care.

## Before you start

1. Fork or clone the repository.
2. Create a focused branch for your change.
3. Install dependencies:

```bash
npm install
```

4. Run WASL locally:

```bash
npm run dev
```

No environment variables, remote database, or account are required.

## Development rules

- Keep WASL Local independent from the private hosted WASL Cloud product.
- Do not add telemetry, analytics, remote tracking, or automatic cloud synchronization.
- Do not introduce required external services for normal Local operation.
- Preserve backward compatibility for persisted user data whenever possible.
- Never silently reset, discard, or overwrite unknown user data.
- MCP write/destructive operations must respect connector permissions and safe entity resolution.
- Do not commit secrets, `.env` files, personal backups, transfer files, or real user data.

For architecture-specific invariants, read [`AGENTS.md`](AGENTS.md).

## Verification

Before opening a pull request, run:

```bash
npm run lint
npm run typecheck
npm test
npm run build:mcp
npm run build
```

Changes affecting MCP, PWA/offline behavior, backups, or browser-storage boundaries should also run the relevant end-to-end tests in `tests/e2e/`.

## Pull requests

Keep pull requests small and explain:

- what changed;
- why it changed;
- which user-facing behavior is affected;
- how you tested it;
- whether persistence, backups, migrations, MCP permissions, or offline behavior are involved.

If a change alters a persisted schema, include the required migration and tests in the same pull request.

## Bug reports

For normal bugs, open a GitHub issue with clear reproduction steps and your browser/OS information when relevant.

For vulnerabilities or privacy issues, follow [`SECURITY.md`](SECURITY.md) instead of opening a public issue.

## License and brand

By contributing, you agree that your contribution can be distributed under this repository's existing [PolyForm Noncommercial License 1.0.0](LICENSE).

The WASL name, logo, and official brand assets are governed separately by [`TRADEMARKS.md`](TRADEMARKS.md).
