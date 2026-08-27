# Security Policy

## Supported versions

WASL Local is currently developed from the `main` branch before its first stable release.

| Channel | Supported |
| --- | --- |
| Latest `main` | ✅ |
| Older snapshots / forks | ❌ |

After tagged stable releases begin, this table will be replaced with a versioned support policy.

## Reporting a vulnerability

Please **do not open a public GitHub issue** for a security vulnerability or privacy issue.

Report sensitive findings privately through GitHub's security reporting flow when available, or contact the maintainer through the contact information on the maintainer's GitHub profile.

A useful report includes:

- affected version or commit;
- steps to reproduce;
- expected and actual behavior;
- impact assessment;
- a minimal proof of concept when appropriate.

Do not include real personal WASL data, connector secrets, credentials, or unrelated private information in a report.

## Security architecture

WASL Local is designed around a narrow local trust boundary:

- Personal workspace data is stored in browser IndexedDB through Dexie.
- The application contains no analytics or telemetry.
- Normal Local operation does not send workspace data to an external backend.
- The direct MCP connector communicates over `127.0.0.1` and requires a connector secret.
- Connector profiles support read/read-write permissions and domain-level access controls.
- Connector secrets can be rotated or revoked from **Settings → AI connections**.

For more detail, see [`docs/security/security-model.md`](docs/security/security-model.md).
