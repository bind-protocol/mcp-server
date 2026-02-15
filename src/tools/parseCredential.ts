import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { parseVCJWT, base64UrlEncode } from '../utils/jwt.js';

export function registerParseCredentialTool(server: McpServer): void {
  server.tool(
    'bind_parse_credential',
    'Decode a Bind Protocol VC-JWT into its header, payload, and signature without verifying the signature. Use this to inspect a credential before verification.',
    { jwt: z.string().describe('The VC-JWT string to parse') },
    async ({ jwt }) => {
      try {
        const { header, payload, signature } = parseVCJWT(jwt);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              header,
              payload,
              signature: base64UrlEncode(signature),
            }, null, 2),
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
