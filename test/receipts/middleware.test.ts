import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ReceiptStore } from '../../src/receipts/store.js';
import { createReceiptProxy } from '../../src/receipts/middleware.js';

function tempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bind-middleware-test-'));
  return path.join(dir, 'test.db');
}

describe('createReceiptProxy', () => {
  const stores: ReceiptStore[] = [];

  afterEach(() => {
    for (const store of stores) {
      try { store.close(); } catch { /* ignore */ }
    }
    stores.length = 0;
    vi.restoreAllMocks();
  });

  it('wraps tool registrations to record receipts on invoke', async () => {
    const store = new ReceiptStore(tempDbPath());
    stores.push(store);

    const server = new McpServer({ name: 'test', version: '0.0.1' });
    const proxied = createReceiptProxy(server, store);

    // Capture the handler by spying on the real server's tool method
    let capturedHandler: Function | undefined;
    const originalTool = server.tool.bind(server);
    vi.spyOn(server, 'tool').mockImplementation(
      (_name: unknown, _desc: unknown, _schema: unknown, fn: unknown) => {
        capturedHandler = fn as Function;
        // Don't actually register since McpServer requires transport
      },
    );

    // Register a tool through the proxy
    proxied.tool(
      'test_tool',
      'A test tool',
      { input: z.string() },
      async ({ input }: { input: string }) => ({
        content: [{ type: 'text' as const, text: `result: ${input}` }],
      }),
    );

    expect(capturedHandler).toBeDefined();

    // Call the captured handler
    const result = await capturedHandler!({ input: 'hello' });
    expect(result).toEqual({
      content: [{ type: 'text', text: 'result: hello' }],
    });

    // Verify receipt was written
    const receipts = store.list();
    expect(receipts).toHaveLength(1);
    expect(receipts[0].tool).toBe('test_tool');
    expect(receipts[0].action).toBe('invoke');
    expect(receipts[0].success).toBe(true);
  });

  it('records failure when handler returns isError', async () => {
    const store = new ReceiptStore(tempDbPath());
    stores.push(store);

    const server = new McpServer({ name: 'test', version: '0.0.1' });
    const proxied = createReceiptProxy(server, store);

    let capturedHandler: Function | undefined;
    vi.spyOn(server, 'tool').mockImplementation(
      (_name: unknown, _desc: unknown, _schema: unknown, fn: unknown) => {
        capturedHandler = fn as Function;
      },
    );

    proxied.tool(
      'failing_tool',
      'A failing tool',
      {},
      async () => ({
        content: [{ type: 'text' as const, text: 'error' }],
        isError: true,
      }),
    );

    await capturedHandler!({});

    const receipts = store.list();
    expect(receipts).toHaveLength(1);
    expect(receipts[0].success).toBe(false);
  });

  it('does not wrap tools in the skip list', async () => {
    const store = new ReceiptStore(tempDbPath());
    stores.push(store);

    const server = new McpServer({ name: 'test', version: '0.0.1' });
    const proxied = createReceiptProxy(server, store);

    let capturedHandler: Function | undefined;
    vi.spyOn(server, 'tool').mockImplementation(
      (_name: unknown, _desc: unknown, _schema: unknown, fn: unknown) => {
        capturedHandler = fn as Function;
      },
    );

    // Register a receipt tool through the proxy — should not be wrapped
    proxied.tool(
      'bind_list_receipts',
      'List receipts',
      {},
      async () => ({
        content: [{ type: 'text' as const, text: '[]' }],
      }),
    );

    await capturedHandler!({});

    // No receipts should have been written (skip list)
    const receipts = store.list();
    expect(receipts).toHaveLength(0);
  });

  it('passes through non-tool properties unchanged', () => {
    const store = new ReceiptStore(tempDbPath());
    stores.push(store);

    const server = new McpServer({ name: 'test', version: '0.0.1' });
    const proxied = createReceiptProxy(server, store);

    // server.resource should still work normally
    expect(typeof proxied.resource).toBe('function');
    expect(typeof proxied.connect).toBe('function');
  });
});
