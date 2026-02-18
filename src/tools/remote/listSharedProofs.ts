import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchAuthenticated } from '../../utils/fetchAuthenticated.js';

export function registerListSharedProofsTool(server: McpServer, apiUrl: string, apiKey: string): void {
  server.tool(
    'bind_list_shared_proofs',
    'List shared proofs for the authenticated organization. Shows proofs that have been shared with or by the organization.',
    {
      limit: z.number().int().positive().optional().describe('Maximum number of shared proofs to return'),
      offset: z.number().int().nonnegative().optional().describe('Number of shared proofs to skip for pagination'),
      direction: z.enum(['asc', 'desc']).optional().describe('Sort direction (default: desc)'),
    },
    async ({ limit, offset, direction }) => {
      try {
        const res = await fetchAuthenticated(apiUrl, '/api/shared-proofs', apiKey, {
          params: {
            limit: limit?.toString(),
            offset: offset?.toString(),
            direction,
          },
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
