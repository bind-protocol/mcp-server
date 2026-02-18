import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchAuthenticated } from '../../utils/fetchAuthenticated.js';

export function registerShareProofTool(server: McpServer, apiUrl: string, apiKey: string): void {
  server.tool(
    'bind_share_proof',
    'Share a completed proof with a verifier organization. Creates a shared proof record that the verifier can access.',
    {
      proveJobId: z.string().uuid().describe('The ID of the completed prove job to share'),
      verifierOrgId: z.string().min(1).describe('The organization ID of the verifier to share with'),
      expiresAt: z.string().optional().describe('ISO 8601 expiration timestamp for the shared proof'),
      note: z.string().optional().describe('Optional note to include with the shared proof'),
    },
    async ({ proveJobId, verifierOrgId, expiresAt, note }) => {
      try {
        const body: Record<string, unknown> = { proveJobId, verifierOrgId };
        if (expiresAt) body.expiresAt = expiresAt;
        if (note) body.note = note;

        const res = await fetchAuthenticated(apiUrl, '/api/shared-proofs', apiKey, {
          method: 'POST',
          body,
        });
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
