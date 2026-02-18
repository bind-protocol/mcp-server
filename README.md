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

Unified MCP server for Bind Protocol — credential tools, API gateway, and action receipts for AI agents.

## Overview

This MCP (Model Context Protocol) server enables AI agents to work with the full Bind Protocol stack through a single server. It provides:

- **Local tools** (always available): Decode, verify, and hash Verifiable Credentials (VC-JWTs)
- **Remote API tools** (with API key): Submit prove jobs, issue credentials, manage policies, share proofs, and more
- **Action receipts**: Tamper-evident audit trail of every tool invocation with hash-chained receipts

## Tools

### Local Tools (always available)

| Tool | Description |
|------|-------------|
| `bind_parse_credential` | Decode a VC-JWT into its header, payload, and signature without verifying the signature. |
| `bind_verify_credential` | Parse a VC-JWT, fetch the issuer's JWKS, verify the ES256 signature, and check expiration. |
| `bind_hash_credential` | Compute the SHA-256 hash of a VC-JWT. |

### Remote API Tools (require `BIND_API_KEY`)

| Tool | Description |
|------|-------------|
| `bind_resolve_issuer` | Fetch an organization's public signing keys (JWKS). |
| `bind_explain_policy` | Fetch the public specification for a policy. |
| `bind_check_revocation` | Check credential revocation status by hash. |
| `bind_list_policies` | List available policies. |
| `bind_list_circuits` | List available circuits. |
| `bind_submit_prove_job` | Submit a new prove job for ZK proof generation. |
| `bind_get_prove_job` | Get the status/result of a prove job. |
| `bind_list_prove_jobs` | List prove jobs with optional filters. |
| `bind_issue_credential` | Issue a verifiable credential from a completed prove job. |
| `bind_share_proof` | Share a completed proof with a verifier organization. |
| `bind_list_shared_proofs` | List shared proofs. |
| `bind_whoami` | Get authenticated org info, tier, and policy limits. |
| `bind_create_policy` | Create a new verification policy. |
| `bind_validate_policy` | Validate a policy spec without creating it. |
| `bind_generate_circuit` | Trigger circuit compilation for a policy. |
| `bind_get_circuit_status` | Poll circuit compilation job status. |

### Receipt Tools (always available when SQLite works)

| Tool | Description |
|------|-------------|
| `bind_record_receipt` | Manually record an action receipt for non-Bind actions. |
| `bind_list_receipts` | Query receipts with filters (tool, time range, pagination). |
| `bind_verify_chain` | Verify that all receipt hashes link correctly. |
| `bind_receipt_summary` | Aggregate stats: total count, per-tool breakdown, success rate. |

## Configuration

Add the server to your MCP client config. **One server, one config:**

```json
{
  "mcpServers": {
    "bind": {
      "command": "npx",
      "args": ["-y", "@bind-protocol/mcp-server"],
      "env": {
        "BIND_API_KEY": "idbr_xxx"
      }
    }
  }
}
```

Without `BIND_API_KEY`, only local tools and receipt tools are available (graceful degradation).

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BIND_API_KEY` | No | — | API key for remote operations. Omit for local-only mode. |
| `BIND_API_URL` | No | `https://api.bindprotocol.xyz` | API base URL. |
| `BIND_RECEIPTS_PATH` | No | `~/.bind/receipts.db` | SQLite database path for receipts. |
| `LOG_LEVEL` | No | `info` | Log verbosity (`fatal`, `error`, `warn`, `info`, `debug`, `trace`). |

### Agent Keys

API keys starting with `idbr_agent_` are validated against the Bind API. Only tools the agent key is authorized to use will be registered. If validation fails, the server gracefully falls back to local-only mode.

## Development

```bash
npm install
npm run build        # Production build
npm run dev          # Build in watch mode
npm run typecheck    # Type-check without emitting
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
```

### Requirements

- Node.js >= 18.0.0

## License

MIT
