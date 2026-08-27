/**
 * lib/relay/presets.ts
 *
 * Universal Connector Presets for WASL Local MCP.
 *
 * Architecture & Guarantees:
 * - Provides tailored configuration formats & installation instructions for 13+ MCP clients.
 * - Presets only generate client-specific configurations and commands; all STDIO clients
 *   connect through the same `packages/wasl-mcp-local` bridge and execute against the shared `LocalMcpExecutor`.
 * - No permanent ports are hardcoded to any preset; all configurations use the dynamic port allocated for that profile.
 */

export type McpClientPresetId =
  | "antigravity"
  | "hermes"
  | "openclaw"
  | "claude-code"
  | "claude-desktop"
  | "codex"
  | "cursor"
  | "windsurf"
  | "vscode"
  | "zed"
  | "continue"
  | "cline"
  | "generic-stdio"
  | "custom";

export type PresetCategory = "IDE / Editor" | "Terminal / CLI" | "Autonomous Agent" | "Custom / Protocol";

export interface ConfigSnippet {
  label: string;
  language: "json" | "yaml" | "bash" | "text";
  filename?: string;
  content: string;
  notes?: string;
}

export interface McpPresetDefinition {
  id: McpClientPresetId;
  name: string;
  category: PresetCategory;
  description: string;
  iconName: string;
  defaultPermission?: "read" | "read_write";
  generateConfigs: (params: {
    port: number;
    secret: string;
    connectionName: string;
    transport?: "stdio" | "http";
  }) => ConfigSnippet[];
  instructions?: string;
}

export const MCP_PRESETS: Record<McpClientPresetId, McpPresetDefinition> = {
  antigravity: {
    id: "antigravity",
    name: "Antigravity IDE & CLI",
    category: "IDE / Editor",
    description: "Official Google Antigravity IDE and agy CLI autonomous coding assistant.",
    iconName: "Sparkles",
    generateConfigs: ({ port, secret }) => [
      {
        label: "JSON Configuration (mcp_config.json)",
        language: "json",
        filename: "~/.gemini/antigravity-ide/mcp_config.json",
        content: JSON.stringify(
          {
            mcpServers: {
              wasl: {
                command: "npx",
                args: ["-y", "wasl-mcp-local", `--port=${port}`, `--secret=${secret}`],
              },
            },
          },
          null,
          2,
        ),
        notes: "Add this configuration to your Antigravity IDE MCP configuration file.",
      },
      {
        label: "Antigravity CLI Command",
        language: "bash",
        content: `agy mcp add wasl npx -y wasl-mcp-local --port=${port} --secret=${secret}`,
        notes: "Run this command in your terminal to register WASL with the Antigravity CLI.",
      },
    ],
    instructions: "Configure Antigravity to connect to your local WASL instance while the WASL PWA is open.",
  },

  hermes: {
    id: "hermes",
    name: "Hermes Agent",
    category: "Autonomous Agent",
    description: "Hermes Autonomous Agent with persistent memory and tool orchestration.",
    iconName: "Bot",
    generateConfigs: ({ port, secret }) => [
      {
        label: "YAML Configuration (config.yaml)",
        language: "yaml",
        filename: "~/.hermes/config.yaml",
        content: `mcp_servers:
  wasl:
    command: "npx"
    args:
      - "-y"
      - "wasl-mcp-local"
      - "--port=${port}"
      - "--secret=${secret}"`,
        notes: "Add under mcp_servers in your Hermes Agent configuration file.",
      },
      {
        label: "JSON Configuration (mcp_servers.json)",
        language: "json",
        filename: "~/.hermes/mcp_servers.json",
        content: JSON.stringify(
          {
            mcp_servers: {
              wasl: {
                command: "npx",
                args: ["-y", "wasl-mcp-local", `--port=${port}`, `--secret=${secret}`],
              },
            },
          },
          null,
          2,
        ),
      },
    ],
  },

  openclaw: {
    id: "openclaw",
    name: "OpenClaw",
    category: "Autonomous Agent",
    description: "OpenClaw Agent runtime with secure sandboxed MCP execution.",
    iconName: "Shield",
    generateConfigs: ({ port, secret }) => [
      {
        label: "OpenClaw Configuration",
        language: "json",
        filename: "~/.openclaw/config.json",
        content: JSON.stringify(
          {
            mcp: {
              servers: {
                wasl: {
                  command: "npx",
                  args: ["-y", "wasl-mcp-local", `--port=${port}`, `--secret=${secret}`],
                  permissions: ["bundle-mcp"],
                },
              },
            },
          },
          null,
          2,
        ),
        notes: "Requires bundle-mcp sandbox permission in OpenClaw config to execute local loopback tools.",
      },
    ],
  },

  "claude-code": {
    id: "claude-code",
    name: "Claude Code",
    category: "Terminal / CLI",
    description: "Anthropic's terminal agent for agentic software engineering.",
    iconName: "Terminal",
    generateConfigs: ({ port, secret }) => [
      {
        label: "CLI Command (Recommended)",
        language: "bash",
        content: `claude mcp add wasl npx -y wasl-mcp-local --port=${port} --secret=${secret}`,
        notes: "Execute in your terminal where Claude Code is installed.",
      },
      {
        label: "Project Configuration (.mcp.json)",
        language: "json",
        filename: ".mcp.json",
        content: JSON.stringify(
          {
            mcpServers: {
              wasl: {
                command: "npx",
                args: ["-y", "wasl-mcp-local", `--port=${port}`, `--secret=${secret}`],
              },
            },
          },
          null,
          2,
        ),
      },
    ],
  },

  "claude-desktop": {
    id: "claude-desktop",
    name: "Claude Desktop",
    category: "IDE / Editor",
    description: "Anthropic's native desktop application for macOS and Windows.",
    iconName: "Cpu",
    generateConfigs: ({ port, secret }) => [
      {
        label: "Desktop Configuration",
        language: "json",
        filename: "claude_desktop_config.json",
        content: JSON.stringify(
          {
            mcpServers: {
              wasl: {
                command: "npx",
                args: ["-y", "wasl-mcp-local", `--port=${port}`, `--secret=${secret}`],
              },
            },
          },
          null,
          2,
        ),
        notes:
          "macOS: ~/Library/Application Support/Claude/claude_desktop_config.json\nWindows: %APPDATA%\\Claude\\claude_desktop_config.json",
      },
    ],
  },

  codex: {
    id: "codex",
    name: "Codex CLI",
    category: "Terminal / CLI",
    description: "Command-line AI companion and coding assistant.",
    iconName: "Terminal",
    generateConfigs: ({ port, secret }) => [
      {
        label: "CLI Command",
        language: "bash",
        content: `codex mcp add wasl npx -y wasl-mcp-local --port=${port} --secret=${secret}`,
        notes: "Run this command to register WASL tools with Codex.",
      },
      {
        label: "JSON Configuration",
        language: "json",
        filename: "~/.codex/config.json",
        content: JSON.stringify(
          {
            mcpServers: {
              wasl: {
                command: "npx",
                args: ["-y", "wasl-mcp-local", `--port=${port}`, `--secret=${secret}`],
              },
            },
          },
          null,
          2,
        ),
      },
    ],
  },

  cursor: {
    id: "cursor",
    name: "Cursor",
    category: "IDE / Editor",
    description: "AI-first code editor with native Model Context Protocol support.",
    iconName: "Code",
    generateConfigs: ({ port, secret }) => [
      {
        label: "Cursor MCP Settings (JSON)",
        language: "json",
        filename: "~/.cursor/mcp.json",
        content: JSON.stringify(
          {
            mcpServers: {
              wasl: {
                command: "npx",
                args: ["-y", "wasl-mcp-local", `--port=${port}`, `--secret=${secret}`],
              },
            },
          },
          null,
          2,
        ),
        notes: "Or go to Cursor Settings > MCP > Add New MCP Server and set Type: command.",
      },
      {
        label: "Cursor UI Values",
        language: "text",
        content: `Name: wasl\nType: command\nCommand: npx -y wasl-mcp-local --port=${port} --secret=${secret}`,
      },
    ],
  },

  windsurf: {
    id: "windsurf",
    name: "Windsurf (Codeium)",
    category: "IDE / Editor",
    description: "Windsurf AI Flow IDE with cascade MCP integration.",
    iconName: "Compass",
    generateConfigs: ({ port, secret }) => [
      {
        label: "Windsurf Configuration",
        language: "json",
        filename: "~/.codeium/windsurf/mcp_config.json",
        content: JSON.stringify(
          {
            mcpServers: {
              wasl: {
                command: "npx",
                args: ["-y", "wasl-mcp-local", `--port=${port}`, `--secret=${secret}`],
              },
            },
          },
          null,
          2,
        ),
      },
    ],
  },

  vscode: {
    id: "vscode",
    name: "VS Code",
    category: "IDE / Editor",
    description: "Visual Studio Code with MCP extensions and tools.",
    iconName: "Code2",
    generateConfigs: ({ port, secret }) => [
      {
        label: "Workspace MCP Configuration (.vscode/mcp.json)",
        language: "json",
        filename: ".vscode/mcp.json",
        content: JSON.stringify(
          {
            mcpServers: {
              wasl: {
                command: "npx",
                args: ["-y", "wasl-mcp-local", `--port=${port}`, `--secret=${secret}`],
              },
            },
          },
          null,
          2,
        ),
      },
    ],
  },

  zed: {
    id: "zed",
    name: "Zed Editor",
    category: "IDE / Editor",
    description: "High-performance code editor with native Context Server support.",
    iconName: "Zap",
    generateConfigs: ({ port, secret }) => [
      {
        label: "Zed Settings (settings.json)",
        language: "json",
        filename: "~/.config/zed/settings.json",
        content: JSON.stringify(
          {
            context_servers: {
              wasl: {
                command: "npx",
                args: ["-y", "wasl-mcp-local", `--port=${port}`, `--secret=${secret}`],
              },
            },
          },
          null,
          2,
        ),
      },
    ],
  },

  continue: {
    id: "continue",
    name: "Continue.dev",
    category: "IDE / Editor",
    description: "Open-source AI code assistant extension for VS Code and JetBrains.",
    iconName: "PlayCircle",
    generateConfigs: ({ port, secret }) => [
      {
        label: "Continue Configuration (config.json)",
        language: "json",
        filename: "~/.continue/config.json",
        content: JSON.stringify(
          {
            experimental: {
              modelContextProtocolServers: [
                {
                  name: "wasl",
                  command: "npx",
                  args: ["-y", "wasl-mcp-local", `--port=${port}`, `--secret=${secret}`],
                },
              ],
            },
          },
          null,
          2,
        ),
      },
    ],
  },

  cline: {
    id: "cline",
    name: "Cline / Roo Code",
    category: "IDE / Editor",
    description: "Autonomous coding agent extension for VS Code.",
    iconName: "Cpu",
    generateConfigs: ({ port, secret }) => [
      {
        label: "Cline MCP Settings",
        language: "json",
        filename: "cline_mcp_settings.json",
        content: JSON.stringify(
          {
            mcpServers: {
              wasl: {
                command: "npx",
                args: ["-y", "wasl-mcp-local", `--port=${port}`, `--secret=${secret}`],
              },
            },
          },
          null,
          2,
        ),
        notes: "Also compatible with Roo Code mcp settings.",
      },
    ],
  },

  "generic-stdio": {
    id: "generic-stdio",
    name: "Generic STDIO MCP Client",
    category: "Custom / Protocol",
    description: "Universal Model Context Protocol client communicating over standard I/O.",
    iconName: "Terminal",
    generateConfigs: ({ port, secret }) => [
      {
        label: "Standard JSON Configuration",
        language: "json",
        content: JSON.stringify(
          {
            mcpServers: {
              wasl: {
                command: "npx",
                args: ["-y", "wasl-mcp-local", `--port=${port}`, `--secret=${secret}`],
              },
            },
          },
          null,
          2,
        ),
      },
      {
        label: "Direct Command",
        language: "bash",
        content: `npx -y wasl-mcp-local --port=${port} --secret=${secret}`,
      },
      {
        label: "Environment Variables",
        language: "text",
        content: `WASL_MCP_PORT=${port}\nWASL_CONNECTOR_SECRET=${secret}`,
      },
    ],
  },

  custom: {
    id: "custom",
    name: "Custom Client",
    category: "Custom / Protocol",
    description: "Custom connector profile with selectable transport (STDIO, HTTP).",
    iconName: "SlidersHorizontal",
    generateConfigs: ({ port, secret, transport = "stdio" }) => {
      if (transport === "http") {
        return [
          {
            label: "Loopback HTTP / SSE Endpoint",
            language: "text",
            content: `http://127.0.0.1:${port}/mcp`,
          },
          {
            label: "Authorization Header",
            language: "text",
            content: `Authorization: Bearer ${secret}`,
          },
        ];
      }

      return [
        {
          label: "Universal STDIO Command",
          language: "bash",
          content: `npx -y wasl-mcp-local --port=${port} --secret=${secret}`,
        },
        {
          label: "Standard JSON Configuration",
          language: "json",
          content: JSON.stringify(
            {
              mcpServers: {
                wasl: {
                  command: "npx",
                  args: ["-y", "wasl-mcp-local", `--port=${port}`, `--secret=${secret}`],
                },
              },
            },
            null,
            2,
          ),
        },
        {
          label: "Raw Connection Values",
          language: "text",
          content: `Loopback Port: ${port}\nWebSocket URL: ws://127.0.0.1:${port}\nConnector Secret: ${secret}`,
        },
      ];
    },
  },
};

export const PRESET_LIST = Object.values(MCP_PRESETS);

export const PRESET_CATEGORIES: PresetCategory[] = [
  "IDE / Editor",
  "Terminal / CLI",
  "Autonomous Agent",
  "Custom / Protocol",
];
