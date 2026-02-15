```
              ━━━╸  888888b. 8888888888b    8888888888b.
            ━━━━━╸  888  "88b  888  8888b   888888  "Y88b
          ━━━━━━━╸  888  .88P  888  88888b  888888    888
        ━━━━━━━━━╸  8888888K.  888  888Y88b 888888    888
      ━━━━━━━━━━━╸  888  "Y88b 888  888 Y88b888888    888
    ━━━━━━━━━━━━━╸  888    888 888  888  Y88888888    888
  ━━━━━━━━━━━━━━━╸  888   d88P 888  888   Y8888888  .d88P
━━━━━━━━━━━━━━━━━╸  8888888P"8888888888    Y8888888888P"

                               P R O T O C O L
```
# @bind-protocol/mcp-server

Local MCP server for Bind Protocol — credential parsing, verification, and hashing tools for AI agents.

## Overview

This MCP (Model Context Protocol) server enables AI agents to work with Bind Protocol Verifiable Credentials (VC-JWTs). It provides tools to decode, cryptographically verify, and hash credentials without requiring direct access to keys or the Bind Protocol API.

## Tools

| Tool | Description |
|------|-------------|
| `bind_parse_credential` | Decode a VC-JWT into its header, payload, and signature without verifying the signature. |
| `bind_verify_credential` | Parse a VC-JWT, fetch the issuer's JWKS, verify the ES256 signature, and check expiration. Does **not** check revocation. |
| `bind_hash_credential` | Compute the SHA-256 hash of a VC-JWT (for use with `bind_check_revocation`). |

## Installation

```bash
npm install @bind-protocol/mcp-server
```

Or clone and build from source:

```bash
git clone <repo-url>
cd mcp-server
npm install
npm run build
```

### Requirements

- Node.js >= 18.0.0

## Configuration

Add the server to your MCP client config. For Claude Desktop, edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bind-protocol": {
      "command": "npx",
      "args": ["@bind-protocol/mcp-server"]
    }
  }
}
```

Or point directly to the built binary:

```json
{
  "mcpServers": {
    "bind-protocol": {
      "command": "bind-mcp-server"
    }
  }
}
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BIND_API_URL` | `https://api.bindprotocol.xyz` | Bind Protocol API endpoint used to fetch issuer JWKS. |
| `LOG_LEVEL` | `info` | Log verbosity (`fatal`, `error`, `warn`, `info`, `debug`, `trace`). |

## Development

```bash
npm run dev          # Build in watch mode
npm run build        # Production build
npm run typecheck    # Type-check without emitting
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
```

## License

MIT
# mcp-server
