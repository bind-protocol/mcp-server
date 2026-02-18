import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ReceiptStore } from '../../receipts/store.js';

export function registerListReceiptsTool(server: McpServer, store: ReceiptStore): void {
  server.tool(
    'bind_list_receipts',
    'Query action receipts with optional filters. Returns a chronologically ordered list of receipts showing what tools were invoked and their outcomes.',
    {
      tool: z.string().optional().describe('Filter by tool name'),
      since: z.string().optional().describe('ISO 8601 timestamp — only receipts after this time'),
      until: z.string().optional().describe('ISO 8601 timestamp — only receipts before this time'),
      limit: z.number().int().positive().optional().describe('Maximum number of receipts to return (default: 100)'),
      offset: z.number().int().nonnegative().optional().describe('Number of receipts to skip for pagination'),
    },
    async ({ tool, since, until, limit, offset }) => {
      try {
        const receipts = store.list({ tool, since, until, limit, offset });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ count: receipts.length, receipts }, null, 2),
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
