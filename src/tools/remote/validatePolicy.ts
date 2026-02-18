import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { POLICY_SCHEMA_DESCRIPTION } from '../policySchemaDescription.js';

export function registerValidatePolicyTool(server: McpServer, apiUrl: string, apiKey: string): void {
  server.tool(
    'bind_validate_policy',
    'Validate a policy specification without creating it. Returns validation errors and warnings, and checks tier limits. Use this before bind_create_policy to catch issues early.',
    {
      policy: z.record(z.string(), z.unknown()).describe(POLICY_SCHEMA_DESCRIPTION),
    },
    async ({ policy }) => {
      try {
        // Use raw fetch so we can return structured validation errors/warnings
        // on 400 responses instead of losing the response body
        const res = await fetch(`${apiUrl}/api/mcp/policies/validate`, {
          method: 'POST',
          headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(policy),
        });
        const data = await res.json();

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(data, null, 2),
          }],
          // Only flag as error for server errors, not validation feedback
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
