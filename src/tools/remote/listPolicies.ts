import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchAuthenticated } from '../../utils/fetchAuthenticated.js';

export function registerListPoliciesTool(server: McpServer, apiUrl: string, apiKey: string): void {
  server.tool(
    'bind_list_policies',
    'List available Bind Protocol policies. Policies define what claims can be proved and what data sources are required.',
    {
      limit: z.number().int().positive().optional().describe('Maximum number of policies to return'),
      offset: z.number().int().nonnegative().optional().describe('Number of policies to skip for pagination'),
    },
    async ({ limit, offset }) => {
      try {
        const res = await fetchAuthenticated(apiUrl, '/api/policies', apiKey, {
          params: {
            limit: limit?.toString(),
            offset: offset?.toString(),
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
