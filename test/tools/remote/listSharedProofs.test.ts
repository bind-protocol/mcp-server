import { describe, it, expect, vi, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListSharedProofsTool } from '../../../src/tools/remote/listSharedProofs.js';
import { captureToolHandler } from '../../helpers.js';

describe('registerListSharedProofsTool', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a tool named bind_list_shared_proofs', () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    const spy = vi.spyOn(server, 'tool');
    registerListSharedProofsTool(server, 'https://api.example.com', 'test_key');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toBe('bind_list_shared_proofs');
  });

  it('fetches shared proofs with query params', async () => {
    const mockData = { sharedProofs: [{ id: 'sp-1' }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    }));

    const handler = captureToolHandler<{ limit?: number; offset?: number; direction?: string }>(
      (server) => registerListSharedProofsTool(server, 'https://api.example.com', 'test_key'),
    );

    const result = await handler({ limit: 10, direction: 'asc' });

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/shared-proofs');
    expect(calledUrl).toContain('limit=10');
    expect(calledUrl).toContain('direction=asc');
    expect(JSON.parse(result.content[0].text)).toEqual(mockData);
  });

  it('returns error on API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }));

    const handler = captureToolHandler<{ limit?: number }>(
      (server) => registerListSharedProofsTool(server, 'https://api.example.com', 'test_key'),
    );

    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toContain('500');
  });
});
