import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchAuthenticated } from '../../utils/fetchAuthenticated.js';

export function registerGetCircuitStatusTool(server: McpServer, apiUrl: string, apiKey: string): void {
  server.tool(
    'bind_get_circuit_status',
    'Get the status of a circuit compilation job. Use the jobId returned by bind_generate_circuit to check progress.',
    {
      jobId: z.string().uuid().describe('The circuit job ID returned by bind_generate_circuit'),
    },
    async ({ jobId }) => {
      try {
        const res = await fetchAuthenticated(apiUrl, `/api/mcp/circuit-jobs/${jobId}`, apiKey);
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
