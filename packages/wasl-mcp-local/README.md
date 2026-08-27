# wasl-mcp-local

Direct STDIO Model Context Protocol (MCP) bridge for **WASL Local Edition**.

Connects local AI assistants (Hermes, Claude Desktop, Cursor, VS Code, Windsurf, etc.) to your local WASL instance over an authenticated loopback WebSocket.

## Quick Start

Run directly via `npx` (configured automatically in WASL Settings):

```bash
npx -y wasl-mcp-local --port=42424 --secret=<YOUR_CONNECTOR_SECRET>
```

## Example MCP Client Config

Add to your MCP client configuration (e.g., `claude_desktop_config.json`, Cursor, or Hermes):

```json
{
  "mcpServers": {
    "wasl": {
      "command": "npx",
      "args": [
        "-y",
        "wasl-mcp-local",
        "--port=42424",
        "--secret=YOUR_CONNECTOR_SECRET"
      ]
    }
  }
}
```

## License

PolyForm Noncommercial 1.0.0
