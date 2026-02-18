import { describe, it, expect, vi, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGetProveJobTool } from '../../../src/tools/remote/getProveJob.js';
import { captureToolHandler } from '../../helpers.js';

describe('registerGetProveJobTool', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a tool named bind_get_prove_job', () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    const spy = vi.spyOn(server, 'tool');
    registerGetProveJobTool(server, 'https://api.example.com', 'test_key');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toBe('bind_get_prove_job');
  });

  it('fetches a prove job by ID', async () => {
    const mockJob = { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', status: 'completed' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockJob,
    }));

    const handler = captureToolHandler<{ jobId: string }>(
      (server) => registerGetProveJobTool(server, 'https://api.example.com', 'test_key'),
    );

    const result = await handler({ jobId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/prove/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      expect.objectContaining({ headers: expect.objectContaining({ 'X-API-Key': 'test_key' }) }),
    );
    expect(JSON.parse(result.content[0].text)).toEqual(mockJob);
  });

  it('returns error on API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }));

    const handler = captureToolHandler<{ jobId: string }>(
      (server) => registerGetProveJobTool(server, 'https://api.example.com', 'test_key'),
    );

    const result = await handler({ jobId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toContain('404');
  });
});
