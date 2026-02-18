import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchAuthenticated } from '../../utils/fetchAuthenticated.js';

export function registerExplainPolicyTool(server: McpServer, apiUrl: string, apiKey: string): void {
  server.tool(
    'bind_explain_policy',
    'Fetch and return the public specification for a Bind Protocol policy. Explains what claims the policy produces and what data sources it requires.',
    {
      policyId: z.string().min(1).regex(/^[\w.\-]+$/, 'policyId must be alphanumeric, dots, hyphens, or underscores').describe('The policy ID to look up (e.g. bind.demo.credit-score)'),
    },
    async ({ policyId }) => {
      try {
        const res = await fetchAuthenticated(apiUrl, `/api/policies/${policyId}`, apiKey);
        const data = await res.json();

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(data, null, 2),
          }],
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
