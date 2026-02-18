import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ReceiptStore } from '../../receipts/store.js';

export function registerRecordReceiptTool(server: McpServer, store: ReceiptStore): void {
  server.tool(
    'bind_record_receipt',
    'Manually record an action receipt for a non-Bind tool invocation. Useful for creating an audit trail of actions taken outside the Bind MCP server.',
    {
      tool: z.string().min(1).describe('Name of the tool or action being recorded'),
      action: z.enum(['invoke', 'block']).describe('Whether the action was invoked or blocked'),
      inputHash: z.string().min(1).describe('SHA-256 hash of the action inputs'),
      outputHash: z.string().min(1).describe('SHA-256 hash of the action outputs'),
      success: z.boolean().describe('Whether the action succeeded'),
    },
    async ({ tool, action, inputHash, outputHash, success }) => {
      try {
        const receipt = store.record({
          tool,
          action,
          inputHash,
          outputHash,
          success,
          durationMs: 0,
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(receipt, null, 2),
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
