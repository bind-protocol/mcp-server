import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { fetchAuthenticated } from '../../utils/fetchAuthenticated.js';

export function registerWhoamiTool(server: McpServer, apiUrl: string, apiKey: string): void {
  server.tool(
    'bind_whoami',
    'Get information about the authenticated organization, tier, policy limits, and (if using an agent key) the key permissions. Use this to understand what you are allowed to do before creating policies.',
    {},
    async () => {
      try {
        const res = await fetchAuthenticated(apiUrl, '/api/mcp/whoami', apiKey);
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
