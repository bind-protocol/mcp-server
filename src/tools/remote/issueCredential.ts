import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchAuthenticated } from '../../utils/fetchAuthenticated.js';

export function registerIssueCredentialTool(server: McpServer, apiUrl: string, apiKey: string): void {
  server.tool(
    'bind_issue_credential',
    'Issue a verifiable credential from a completed prove job. The prove job must have status "completed" before a credential can be issued.',
    {
      proveJobId: z.string().uuid().describe('The ID of the completed prove job to issue a credential from'),
      format: z.enum(['compact', 'self-verifiable']).optional().describe('Credential format (default: compact)'),
      subjectId: z.string().optional().describe('Optional DID or identifier of the credential subject'),
      expiresIn: z.number().int().positive().optional().describe('Credential expiration in seconds from now'),
    },
    async ({ proveJobId, format, subjectId, expiresIn }) => {
      try {
        const body: Record<string, unknown> = {};
        if (format) body.format = format;
        if (subjectId) body.subjectId = subjectId;
        if (expiresIn) body.expiresIn = expiresIn;

        const res = await fetchAuthenticated(apiUrl, `/api/prove-jobs/${proveJobId}/credential`, apiKey, {
          method: 'POST',
          body,
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
