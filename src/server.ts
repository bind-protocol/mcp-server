import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerParseCredentialTool } from './tools/parseCredential.js';
import { registerVerifyCredentialTool } from './tools/verifyCredential.js';
import { registerHashCredentialTool } from './tools/hashCredential.js';

import {
  registerResolveIssuerTool,
  registerExplainPolicyTool,
  registerCheckRevocationTool,
  registerListPoliciesTool,
  registerListCircuitsTool,
  registerSubmitProveJobTool,
  registerGetProveJobTool,
  registerListProveJobsTool,
  registerIssueCredentialTool,
  registerShareProofTool,
  registerListSharedProofsTool,
  registerWhoamiTool,
  registerCreatePolicyTool,
  registerValidatePolicyTool,
  registerGenerateCircuitTool,
  registerGetCircuitStatusTool,
} from './tools/remote/index.js';

import {
  registerRecordReceiptTool,
  registerListReceiptsTool,
  registerVerifyChainTool,
  registerReceiptSummaryTool,
} from './tools/receipts/index.js';

import { ReceiptStore } from './receipts/store.js';
import { createReceiptProxy } from './receipts/middleware.js';
import { registerDocResources } from './resources/docs.js';
import { logger } from './utils/logger.js';

const DEFAULT_API_URL = 'https://api.bindprotocol.xyz';

/**
 * Tool registry mapping tool names to their registration functions.
 * Used for conditional registration based on agent key permissions.
 */
const REMOTE_TOOL_REGISTRY: Record<string, (server: McpServer, apiUrl: string, apiKey: string) => void> = {
  bind_resolve_issuer: registerResolveIssuerTool,
  bind_explain_policy: registerExplainPolicyTool,
  bind_check_revocation: registerCheckRevocationTool,
  bind_list_policies: registerListPoliciesTool,
  bind_list_circuits: registerListCircuitsTool,
  bind_submit_prove_job: registerSubmitProveJobTool,
  bind_get_prove_job: registerGetProveJobTool,
  bind_list_prove_jobs: registerListProveJobsTool,
  bind_issue_credential: registerIssueCredentialTool,
  bind_share_proof: registerShareProofTool,
  bind_list_shared_proofs: registerListSharedProofsTool,
  bind_whoami: registerWhoamiTool,
  bind_create_policy: registerCreatePolicyTool,
  bind_validate_policy: registerValidatePolicyTool,
  bind_generate_circuit: registerGenerateCircuitTool,
  bind_get_circuit_status: registerGetCircuitStatusTool,
};

export async function createServer(): Promise<McpServer> {
  const server = new McpServer({
    name: 'bind-protocol',
    version: '0.2.0',
  });

  // --- Receipt system (best-effort) ---
  let receiptStore: ReceiptStore | null = null;
  let toolServer: McpServer = server;

  try {
    receiptStore = new ReceiptStore();
    const apiKey = process.env.BIND_API_KEY;
    const apiKeyPrefix = apiKey ? apiKey.slice(0, 12) + '...' : undefined;
    toolServer = createReceiptProxy(server, receiptStore, apiKeyPrefix);
    logger.info('Receipt system enabled');
  } catch (err) {
    logger.warn({ err }, 'Receipt system unavailable — tools will work without receipts');
  }

  // Always register the 3 local (stateless) tools via the proxied server
  registerParseCredentialTool(toolServer);
  registerVerifyCredentialTool(toolServer);
  registerHashCredentialTool(toolServer);

  // Conditionally register remote API tools if an API key is provided
  const apiKey = process.env.BIND_API_KEY;
  const apiUrl = process.env.BIND_API_URL ?? DEFAULT_API_URL;

  if (apiKey) {
    if (apiKey.startsWith('idbr_agent_')) {
      // Agent key: validate via API and register only allowed tools
      try {
        const response = await fetch(`${apiUrl}/api/agent-keys/validate`, {
          headers: { 'X-API-Key': apiKey },
          signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) {
          logger.warn({ status: response.status }, 'Agent key validation failed — remote tools disabled');
        } else {
          const result = (await response.json()) as {
            success: boolean;
            data?: { allowedTools?: string[] };
          };

          const allowedTools = result.data?.allowedTools ?? [];
          for (const toolName of allowedTools) {
            const registerFn = REMOTE_TOOL_REGISTRY[toolName];
            if (registerFn) {
              registerFn(toolServer, apiUrl, apiKey);
            }
          }
          logger.info({ count: allowedTools.length }, 'Agent key validated — registered allowed remote tools');
        }
      } catch (err) {
        logger.warn({ err }, 'Agent key validation error — remote tools disabled');
      }
    } else {
      // Regular API keys cannot be used for MCP — use an agent key
      logger.warn(
        'Regular API keys (idbr_) are not supported for MCP tool access. '
        + 'Create an agent key (idbr_agent_) in the dashboard for AI agent use.'
      );
    }
  } else {
    logger.info('No BIND_API_KEY — running with local tools only');
  }

  // Register receipt query tools on the REAL (unproxied) server to avoid recursion
  if (receiptStore) {
    registerRecordReceiptTool(server, receiptStore);
    registerListReceiptsTool(server, receiptStore);
    registerVerifyChainTool(server, receiptStore);
    registerReceiptSummaryTool(server, receiptStore);
    logger.info('Receipt query tools registered (4 tools)');
  }

  // Always register doc resources
  registerDocResources(server);

  // Cleanup on exit
  const cleanup = () => {
    if (receiptStore) {
      try {
        receiptStore.close();
      } catch {
        // Ignore errors during shutdown
      }
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });

  return server;
}
