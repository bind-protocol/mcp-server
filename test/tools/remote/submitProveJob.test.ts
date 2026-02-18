import { describe, it, expect, vi, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSubmitProveJobTool } from '../../../src/tools/remote/submitProveJob.js';
import { captureToolHandler } from '../../helpers.js';

describe('registerSubmitProveJobTool', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a tool named bind_submit_prove_job', () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    const spy = vi.spyOn(server, 'tool');
    registerSubmitProveJobTool(server, 'https://api.example.com', 'test_key');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toBe('bind_submit_prove_job');
  });

  it('submits a prove job via POST', async () => {
    const mockResponse = { id: 'job-123', status: 'pending' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }));

    const handler = captureToolHandler<{ circuitId: string; inputs: Record<string, string>; verificationMode?: string }>(
      (server) => registerSubmitProveJobTool(server, 'https://api.example.com', 'test_key'),
    );

    const result = await handler({ circuitId: 'circuit-1', inputs: { age: '25' } });

    const [calledUrl, calledOpts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toBe('https://api.example.com/api/prove');
    expect(calledOpts.method).toBe('POST');
    expect(calledOpts.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(calledOpts.body)).toEqual({ circuitId: 'circuit-1', inputs: { age: '25' } });
    expect(JSON.parse(result.content[0].text)).toEqual(mockResponse);
  });

  it('returns error on API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    }));

    const handler = captureToolHandler<{ circuitId: string; inputs: Record<string, string> }>(
      (server) => registerSubmitProveJobTool(server, 'https://api.example.com', 'test_key'),
    );

    const result = await handler({ circuitId: 'bad', inputs: {} });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toContain('400');
  });
});
