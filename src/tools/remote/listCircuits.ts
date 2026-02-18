import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchAuthenticated } from '../../utils/fetchAuthenticated.js';

export function registerListCircuitsTool(server: McpServer, apiUrl: string, apiKey: string): void {
  server.tool(
    'bind_list_circuits',
    'List available Bind Protocol circuits. Circuits define the zero-knowledge proof logic used by policies.',
    {
      limit: z.number().int().positive().optional().describe('Maximum number of circuits to return'),
      offset: z.number().int().nonnegative().optional().describe('Number of circuits to skip for pagination'),
    },
    async ({ limit, offset }) => {
      try {
        const res = await fetchAuthenticated(apiUrl, '/api/circuits', apiKey, {
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
