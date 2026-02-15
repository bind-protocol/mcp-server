import crypto from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerHashCredentialTool(server: McpServer): void {
  server.tool(
    'bind_hash_credential',
    'Compute the SHA-256 hash of a VC-JWT. The resulting hash can be passed to bind_check_revocation to check revocation status.',
    { jwt: z.string().min(1).describe('The VC-JWT string to hash') },
    async ({ jwt }) => {
      try {
        const hash = '0x' + crypto.createHash('sha256').update(jwt).digest('hex');

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ hash }, null, 2),
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
