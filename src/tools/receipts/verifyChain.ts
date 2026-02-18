import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReceiptStore } from '../../receipts/store.js';

export function registerVerifyChainTool(server: McpServer, store: ReceiptStore): void {
  server.tool(
    'bind_verify_chain',
    'Walk the receipt chain and verify that all hashes link correctly. Returns whether the chain is valid and where it breaks if not.',
    {},
    async () => {
      try {
        const result = store.verifyChain();

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
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
