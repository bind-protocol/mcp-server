import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReceiptStore } from '../../receipts/store.js';

export function registerReceiptSummaryTool(server: McpServer, store: ReceiptStore): void {
  server.tool(
    'bind_receipt_summary',
    'Get aggregate statistics about action receipts: total count, per-tool breakdown, success rate, chain validity, and time range.',
    {},
    async () => {
      try {
        const summary = store.summary();

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(summary, null, 2),
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
