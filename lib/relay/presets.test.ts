/**
 * lib/relay/presets.test.ts
 *
 * Unit tests for Universal Connector Presets.
 */

import { describe, it, expect } from "vitest";
import { MCP_PRESETS, PRESET_LIST, PRESET_CATEGORIES } from "./presets";

describe("Universal Connector Presets Catalog", () => {
  it("includes all 14 standard presets and categories", () => {
    expect(PRESET_LIST.length).toBe(14);
    expect(PRESET_CATEGORIES).toContain("IDE / Editor");
    expect(PRESET_CATEGORIES).toContain("Terminal / CLI");
    expect(PRESET_CATEGORIES).toContain("Autonomous Agent");
    expect(PRESET_CATEGORIES).toContain("Custom / Protocol");

    const expectedPresetIds = [
      "antigravity",
      "hermes",
      "openclaw",
      "claude-code",
      "claude-desktop",
      "codex",
      "cursor",
      "windsurf",
      "vscode",
      "zed",
      "continue",
      "cline",
      "generic-stdio",
      "custom",
    ];

    for (const id of expectedPresetIds) {
      expect(MCP_PRESETS[id as keyof typeof MCP_PRESETS]).toBeDefined();
      expect(MCP_PRESETS[id as keyof typeof MCP_PRESETS].id).toBe(id);
    }
  });

  it("generates valid Antigravity IDE and CLI configurations", () => {
    const preset = MCP_PRESETS.antigravity;
    const configs = preset.generateConfigs({
      port: 42424,
      secret: "sec_ag_test_123",
      connectionName: "Antigravity IDE",
    });

    expect(configs.length).toBe(2);
    // JSON Config
    const jsonConfig = configs.find((c) => c.language === "json");
    expect(jsonConfig).toBeDefined();
    const parsed = JSON.parse(jsonConfig!.content);
    expect(parsed.mcpServers.wasl.command).toBe("npx");
    expect(parsed.mcpServers.wasl.args).toEqual(["-y", "wasl-mcp-local", "--port=42424", "--secret=sec_ag_test_123"]);

    // CLI Command
    const cliConfig = configs.find((c) => c.language === "bash");
    expect(cliConfig).toBeDefined();
    expect(cliConfig!.content).toBe("agy mcp add wasl npx -y wasl-mcp-local --port=42424 --secret=sec_ag_test_123");
  });

  it("generates valid Hermes Agent YAML and JSON configurations", () => {
    const preset = MCP_PRESETS.hermes;
    const configs = preset.generateConfigs({
      port: 42425,
      secret: "sec_hermes_test_456",
      connectionName: "Hermes Agent",
    });

    expect(configs.length).toBe(2);
    const yamlConfig = configs.find((c) => c.language === "yaml");
    expect(yamlConfig).toBeDefined();
    expect(yamlConfig!.content).toContain("wasl-mcp-local");
    expect(yamlConfig!.content).toContain("--port=42425");
    expect(yamlConfig!.content).toContain("--secret=sec_hermes_test_456");

    const jsonConfig = configs.find((c) => c.language === "json");
    expect(jsonConfig).toBeDefined();
    const parsed = JSON.parse(jsonConfig!.content);
    expect(parsed.mcp_servers.wasl.command).toBe("npx");
  });

  it("generates valid OpenClaw configuration with bundle-mcp permission notice", () => {
    const preset = MCP_PRESETS.openclaw;
    const configs = preset.generateConfigs({
      port: 42426,
      secret: "sec_openclaw_test_789",
      connectionName: "OpenClaw",
    });

    expect(configs.length).toBe(1);
    const parsed = JSON.parse(configs[0].content);
    expect(parsed.mcp.servers.wasl.permissions).toContain("bundle-mcp");
    expect(configs[0].notes).toContain("bundle-mcp");
  });

  it("generates valid Claude Code command", () => {
    const preset = MCP_PRESETS["claude-code"];
    const configs = preset.generateConfigs({
      port: 42427,
      secret: "sec_cc_test",
      connectionName: "Claude Code",
    });

    const cliConfig = configs.find((c) => c.language === "bash");
    expect(cliConfig!.content).toBe("claude mcp add wasl npx -y wasl-mcp-local --port=42427 --secret=sec_cc_test");
  });

  it("generates valid Zed Context Server JSON config", () => {
    const preset = MCP_PRESETS.zed;
    const configs = preset.generateConfigs({
      port: 42428,
      secret: "sec_zed_test",
      connectionName: "Zed",
    });

    const jsonConfig = configs.find((c) => c.language === "json");
    const parsed = JSON.parse(jsonConfig!.content);
    expect(parsed.context_servers.wasl.command).toBe("npx");
    expect(parsed.context_servers.wasl.args).toContain("--port=42428");
  });

  it("generates valid Custom Client configs for STDIO and HTTP transports", () => {
    const preset = MCP_PRESETS.custom;

    // 1. STDIO Transport
    const stdioConfigs = preset.generateConfigs({
      port: 42430,
      secret: "sec_custom_stdio",
      connectionName: "Custom STDIO",
      transport: "stdio",
    });
    expect(stdioConfigs.some((c) => c.content.includes("npx -y wasl-mcp-local"))).toBe(true);

    // 2. HTTP Transport
    const httpConfigs = preset.generateConfigs({
      port: 42431,
      secret: "sec_custom_http",
      connectionName: "Custom HTTP",
      transport: "http",
    });
    expect(httpConfigs.some((c) => c.content.includes("http://127.0.0.1:42431/mcp"))).toBe(true);
    expect(httpConfigs.some((c) => c.content.includes("Authorization: Bearer sec_custom_http"))).toBe(true);
  });
});
