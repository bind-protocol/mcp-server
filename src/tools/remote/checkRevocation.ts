import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchAuthenticated } from '../../utils/fetchAuthenticated.js';

export function registerCheckRevocationTool(server: McpServer, apiUrl: string, apiKey: string): void {
  server.tool(
    'bind_check_revocation',
    'Check the revocation status of a Bind Protocol credential by its hash. Use bind_hash_credential to compute the hash from a VC-JWT first.',
    {
      credentialHash: z.string().min(1).regex(/^(0x)?[a-fA-F0-9]+$/, 'credentialHash must be a hex string').describe('The SHA-256 hash of the credential to check (hex string, optionally 0x-prefixed)'),
    },
    async ({ credentialHash }) => {
      try {
        const res = await fetchAuthenticated(apiUrl, `/api/credentials/${credentialHash}/status`, apiKey);
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
