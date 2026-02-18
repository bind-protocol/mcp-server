import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchAuthenticated } from '../../utils/fetchAuthenticated.js';

export function registerResolveIssuerTool(server: McpServer, apiUrl: string, apiKey: string): void {
  server.tool(
    'bind_resolve_issuer',
    "Fetch an organization's public signing keys (JWKS) from the Bind Protocol API. Use this to inspect which keys an org has available for credential signing.",
    {
      orgId: z.string().min(1).regex(/^[\w-]+$/, 'orgId must be alphanumeric, hyphens, or underscores').describe('The organization ID to resolve'),
    },
    async ({ orgId }) => {
      try {
        const res = await fetchAuthenticated(apiUrl, `/api/orgs/${orgId}/.well-known/jwks.json`, apiKey);
        const jwks = await res.json();

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(jwks, null, 2),
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
