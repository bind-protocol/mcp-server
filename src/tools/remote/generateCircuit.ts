import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerGenerateCircuitTool(server: McpServer, apiUrl: string, apiKey: string): void {
  server.tool(
    'bind_generate_circuit',
    'Trigger circuit compilation for a policy. This queues an async job that generates the ZK circuit. Use bind_get_circuit_status to poll the job progress.',
    {
      policyId: z.string().min(1).describe('The policy ID (e.g., "bind.myorg.credit-score")'),
      version: z.string().optional().describe('Specific policy version (defaults to latest)'),
      force: z.boolean().optional().describe('Force regeneration even if circuit is already validated'),
      validateAfterGeneration: z.boolean().optional().describe('Run validation after generation (default: true)'),
    },
    async ({ policyId, version, force, validateAfterGeneration }) => {
      try {
        const body: Record<string, unknown> = {};
        if (version) body.version = version;
        if (validateAfterGeneration !== undefined) body.validateAfterGeneration = validateAfterGeneration;

        let url = `${apiUrl}/api/mcp/policies/${encodeURIComponent(policyId)}/generate-circuit`;
        if (force) url += '?force=true';

        // Use raw fetch so we can return 404/403 error details to the agent
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(data, null, 2),
          }],
          ...(res.status >= 500 ? { isError: true } : {}),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
          isError: true,
        };
      }
    },
  );
}
