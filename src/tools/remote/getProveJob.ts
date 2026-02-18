import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchAuthenticated } from '../../utils/fetchAuthenticated.js';

export function registerGetProveJobTool(server: McpServer, apiUrl: string, apiKey: string): void {
  server.tool(
    'bind_get_prove_job',
    'Get the status and result of a prove job by its ID. Poll this after submitting a prove job to check if the proof is ready.',
    {
      jobId: z.string().uuid().describe('The prove job ID to look up'),
    },
    async ({ jobId }) => {
      try {
        const res = await fetchAuthenticated(apiUrl, `/api/prove/${jobId}`, apiKey);
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
