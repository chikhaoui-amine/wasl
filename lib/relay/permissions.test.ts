/**
 * lib/relay/permissions.test.ts
 *
 * Unit tests for permissions, dynamic port allocation, multi-instance connectors, and lossless migration.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  allocateAvailablePort,
  createConnectorProfile,
  deleteConnectorProfile,
  loadClientProfiles,
  saveClientProfiles,
  rotateClientSecret,
  toggleClientEnabled,
  revokeClientProfile,
  _resetProfilesForTest,
  type McpClientProfile,
} from "./permissions";

describe("Universal Connector Permissions & Profile Management", () => {
  beforeEach(() => {
    _resetProfilesForTest();
  });

  it("dynamically allocates available loopback ports in 42424–42499 without collision", () => {
    const profiles: McpClientProfile[] = [
      { id: "1", name: "C1", type: "direct", port: 42424, secret: "s1", permission: "read", allowedDomains: [], createdAt: "", lastActiveAt: "", enabled: true, revoked: false },
      { id: "2", name: "C2", type: "direct", port: 42425, secret: "s2", permission: "read", allowedDomains: [], createdAt: "", lastActiveAt: "", enabled: true, revoked: false },
    ];

    const nextPort = allocateAvailablePort(profiles, 42424, 42499);
    expect(nextPort).toBe(42426);
  });

  it("supports creating multiple simultaneous instances of the same client preset", () => {
    const cursor1 = createConnectorProfile({
      presetId: "cursor",
      name: "Cursor Work",
      permission: "read_write",
    });

    const cursor2 = createConnectorProfile({
      presetId: "cursor",
      name: "Cursor Personal",
      permission: "read",
    });

    expect(cursor1.id).not.toBe(cursor2.id);
    expect(cursor1.port).not.toBe(cursor2.port);
    expect(cursor1.secret).not.toBe(cursor2.secret);
    expect(cursor1.name).toBe("Cursor Work");
    expect(cursor2.name).toBe("Cursor Personal");

    const list = loadClientProfiles();
    expect(list.some((p) => p.id === cursor1.id)).toBe(true);
    expect(list.some((p) => p.id === cursor2.id)).toBe(true);
  });

  it("migrates legacy stored profiles non-destructively preserving existing secrets and ports", () => {
    const legacyRaw = [
      {
        id: "client_claude_code",
        name: "Claude Code",
        type: "direct",
        port: 42424,
        secret: "wasl_sec_legacy_preserved_secret_12345",
        permission: "read_write",
        allowedDomains: ["tasks", "notes"],
        createdAt: "2026-01-01T00:00:00Z",
        lastActiveAt: "2026-01-01T00:00:00Z",
        revoked: false,
      },
    ];

    saveClientProfiles(legacyRaw as unknown as McpClientProfile[]);

    const migrated = loadClientProfiles();
    const cc = migrated.find((p) => p.id === "client_claude_code");
    expect(cc).toBeDefined();
    expect(cc?.secret).toBe("wasl_sec_legacy_preserved_secret_12345");
    expect(cc?.port).toBe(42424);
    expect(cc?.presetId).toBe("claude-code");
    expect(cc?.enabled).toBe(true);
  });

  it("toggles enabled and revoked states correctly", () => {
    const profile = createConnectorProfile({
      presetId: "antigravity",
      name: "Antigravity AGY",
    });

    expect(profile.enabled).toBe(true);
    expect(profile.revoked).toBe(false);

    // Toggle enabled
    const isEnabled = toggleClientEnabled(profile.id);
    expect(isEnabled).toBe(false);

    // Revoke
    revokeClientProfile(profile.id);
    const updated = loadClientProfiles().find((p) => p.id === profile.id);
    expect(updated?.revoked).toBe(true);
  });

  it("rotates connector secret with new 256-bit random string", () => {
    const profile = createConnectorProfile({
      presetId: "zed",
      name: "Zed Editor",
    });

    const oldSecret = profile.secret;
    const newSecret = rotateClientSecret(profile.id);

    expect(newSecret).not.toBe(oldSecret);
    expect(newSecret.startsWith("wasl_sec_")).toBe(true);

    const updated = loadClientProfiles().find((p) => p.id === profile.id);
    expect(updated?.secret).toBe(newSecret);
  });

  it("deletes a connector profile cleanly", () => {
    const profile = createConnectorProfile({
      presetId: "continue",
      name: "Continue.dev",
    });

    expect(deleteConnectorProfile(profile.id)).toBe(true);
    const list = loadClientProfiles();
    expect(list.some((p) => p.id === profile.id)).toBe(false);
  });
});
