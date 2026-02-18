import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { POLICY_SCHEMA_DESCRIPTION } from '../policySchemaDescription.js';

export function registerCreatePolicyTool(server: McpServer, apiUrl: string, apiKey: string): void {
  server.tool(
    'bind_create_policy',
    'Create a new verification policy. The policy spec must include id, version, metadata (title, namespace, description), subject, inputs, rules, evaluation, outputs, and optionally validity, disclosure, and proving sections. Use bind_validate_policy first to check for errors.',
    {
      policy: z.record(z.string(), z.unknown()).describe(POLICY_SCHEMA_DESCRIPTION),
    },
    async ({ policy }) => {
      try {
        // Use raw fetch so we can return the response body on non-ok responses
        // (validation errors, tier limit errors) instead of losing them
        const res = await fetch(`${apiUrl}/api/mcp/policies`, {
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
          // Only flag as error for server errors, not validation failures
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
