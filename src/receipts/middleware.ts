import crypto from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReceiptStore } from './store.js';
import { logger } from '../utils/logger.js';

/** Tools that should NOT be receipt-wrapped (to avoid infinite recursion). */
const SKIP_LIST = new Set([
  'bind_record_receipt',
  'bind_list_receipts',
  'bind_verify_chain',
  'bind_receipt_summary',
]);

function hashValue(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

/**
 * Creates a Proxy around McpServer that intercepts `server.tool()` calls.
 * When a tool is registered through the proxy, its handler is wrapped to
 * automatically record receipts for every invocation.
 */
export function createReceiptProxy(
  server: McpServer,
  store: ReceiptStore,
  apiKeyPrefix?: string,
): McpServer {
  return new Proxy(server, {
    get(target, prop, receiver) {
      if (prop !== 'tool') {
        return Reflect.get(target, prop, receiver);
      }

      // Return a wrapped version of server.tool()
      return function wrappedTool(...args: unknown[]) {
        const toolName = args[0] as string;

        // If this tool is in the skip list, register directly without wrapping
        if (SKIP_LIST.has(toolName)) {
          return (target.tool as Function).apply(target, args);
        }

        // The handler is always the last argument (works for all server.tool() overloads)
        const handlerIndex = args.findLastIndex((a) => typeof a === 'function');
        if (handlerIndex === -1) {
          return (target.tool as Function).apply(target, args);
        }
        const originalHandler = args[handlerIndex] as Function;

        // Replace the handler with a receipt-recording wrapper
        args[handlerIndex] = async function receiptWrapper(...handlerArgs: unknown[]) {
          const inputHash = hashValue(handlerArgs);
          const start = Date.now();
          let success = true;
          let result: unknown;

          try {
            result = await originalHandler.apply(this, handlerArgs);
            // Check if the result has isError flag
            const resultObj = result as { isError?: boolean } | undefined;
            if (resultObj?.isError) {
              success = false;
            }
            return result;
          } catch (err) {
            success = false;
            throw err;
          } finally {
            const durationMs = Date.now() - start;
            const outputHash = hashValue(result ?? null);

            try {
              store.record({
                tool: toolName,
                action: 'invoke',
                inputHash,
                outputHash,
                success,
                apiKeyPrefix,
                durationMs,
              });
            } catch (receiptErr) {
              logger.warn({ err: receiptErr, tool: toolName }, 'Failed to write receipt — tool result unaffected');
            }
          }
        };

        return (target.tool as Function).apply(target, args);
      };
    },
  });
}
