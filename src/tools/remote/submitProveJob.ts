import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchAuthenticated } from '../../utils/fetchAuthenticated.js';

export function registerSubmitProveJobTool(server: McpServer, apiUrl: string, apiKey: string): void {
  server.tool(
    'bind_submit_prove_job',
    'Submit a new prove job to generate a zero-knowledge proof. Use bind_list_policies or bind_list_circuits to discover available circuits first. Poll the job status with bind_get_prove_job.',
    {
      circuitId: z.string().min(1).describe('The circuit ID to use for proof generation'),
      inputs: z.record(z.string(), z.string()).describe('Key-value map of circuit inputs'),
      verificationMode: z.enum(['zkverify', 'self_verify']).optional().describe('How the proof should be verified (default: zkverify)'),
    },
    async ({ circuitId, inputs, verificationMode }) => {
      try {
        const body: Record<string, unknown> = { circuitId, inputs };
        if (verificationMode) body.verificationMode = verificationMode;

        const res = await fetchAuthenticated(apiUrl, '/api/prove', apiKey, {
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
