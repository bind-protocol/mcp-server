import { describe, it, expect, vi, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListPoliciesTool } from '../../../src/tools/remote/listPolicies.js';
import { captureToolHandler } from '../../helpers.js';

describe('registerListPoliciesTool', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a tool named bind_list_policies', () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    const spy = vi.spyOn(server, 'tool');
    registerListPoliciesTool(server, 'https://api.example.com', 'test_key');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toBe('bind_list_policies');
  });

  it('fetches policies with query params', async () => {
    const mockData = { policies: [{ id: 'p1' }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    }));

    const handler = captureToolHandler<{ limit?: number; offset?: number }>(
      (server) => registerListPoliciesTool(server, 'https://api.example.com', 'test_key'),
    );

    const result = await handler({ limit: 10, offset: 0 });

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/policies');
    expect(calledUrl).toContain('limit=10');
    expect(calledUrl).toContain('offset=0');
    expect(JSON.parse(result.content[0].text)).toEqual(mockData);
  });

  it('omits undefined params', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ policies: [] }),
    }));

    const handler = captureToolHandler<{ limit?: number; offset?: number }>(
      (server) => registerListPoliciesTool(server, 'https://api.example.com', 'test_key'),
    );

    await handler({});

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toBe('https://api.example.com/api/policies');
  });

  it('returns error on API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }));

    const handler = captureToolHandler<{ limit?: number; offset?: number }>(
      (server) => registerListPoliciesTool(server, 'https://api.example.com', 'test_key'),
    );

    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toContain('500');
  });
});
