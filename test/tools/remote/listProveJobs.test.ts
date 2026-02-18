import { describe, it, expect, vi, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListProveJobsTool } from '../../../src/tools/remote/listProveJobs.js';
import { captureToolHandler } from '../../helpers.js';

describe('registerListProveJobsTool', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a tool named bind_list_prove_jobs', () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    const spy = vi.spyOn(server, 'tool');
    registerListProveJobsTool(server, 'https://api.example.com', 'test_key');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toBe('bind_list_prove_jobs');
  });

  it('fetches prove jobs with filters', async () => {
    const mockData = { jobs: [{ id: 'j1', status: 'completed' }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    }));

    const handler = captureToolHandler<{ status?: string; limit?: number; offset?: number; direction?: string }>(
      (server) => registerListProveJobsTool(server, 'https://api.example.com', 'test_key'),
    );

    const result = await handler({ status: 'completed', limit: 20 });

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/prove');
    expect(calledUrl).toContain('status=completed');
    expect(calledUrl).toContain('limit=20');
    expect(JSON.parse(result.content[0].text)).toEqual(mockData);
  });

  it('returns error on API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }));

    const handler = captureToolHandler<{ status?: string }>(
      (server) => registerListProveJobsTool(server, 'https://api.example.com', 'test_key'),
    );

    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toContain('500');
  });
});
