import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchAuthenticated } from '../../utils/fetchAuthenticated.js';

export function registerListProveJobsTool(server: McpServer, apiUrl: string, apiKey: string): void {
  server.tool(
    'bind_list_prove_jobs',
    'List prove jobs for the authenticated organization. Optionally filter by status.',
    {
      status: z.enum(['pending', 'processing', 'completed', 'failed']).optional().describe('Filter jobs by status'),
      limit: z.number().int().positive().optional().describe('Maximum number of jobs to return'),
      offset: z.number().int().nonnegative().optional().describe('Number of jobs to skip for pagination'),
      direction: z.enum(['asc', 'desc']).optional().describe('Sort direction (default: desc)'),
    },
    async ({ status, limit, offset, direction }) => {
      try {
        const res = await fetchAuthenticated(apiUrl, '/api/prove', apiKey, {
          params: {
            status,
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
