import { describe, it, expect, vi, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListCircuitsTool } from '../../../src/tools/remote/listCircuits.js';
import { captureToolHandler } from '../../helpers.js';

describe('registerListCircuitsTool', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a tool named bind_list_circuits', () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    const spy = vi.spyOn(server, 'tool');
    registerListCircuitsTool(server, 'https://api.example.com', 'test_key');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toBe('bind_list_circuits');
  });

  it('fetches circuits with query params', async () => {
    const mockData = { circuits: [{ id: 'c1' }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    }));

    const handler = captureToolHandler<{ limit?: number; offset?: number }>(
      (server) => registerListCircuitsTool(server, 'https://api.example.com', 'test_key'),
    );

    const result = await handler({ limit: 5 });

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/circuits');
    expect(calledUrl).toContain('limit=5');
    expect(JSON.parse(result.content[0].text)).toEqual(mockData);
  });

  it('returns error on API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    }));

    const handler = captureToolHandler<{ limit?: number; offset?: number }>(
      (server) => registerListCircuitsTool(server, 'https://api.example.com', 'test_key'),
    );

    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toContain('403');
  });
});
