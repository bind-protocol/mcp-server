import { describe, it, expect, vi, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerCheckRevocationTool } from '../../../src/tools/remote/checkRevocation.js';
import { captureToolHandler } from '../../helpers.js';

describe('registerCheckRevocationTool', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a tool named bind_check_revocation', () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    const spy = vi.spyOn(server, 'tool');
    registerCheckRevocationTool(server, 'https://api.example.com', 'bind_sk_test');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toBe('bind_check_revocation');
  });

  it('fetches revocation status with auth header', async () => {
    const mockStatus = { revoked: false };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockStatus,
    }));

    const handler = captureToolHandler<{ credentialHash: string }>(
      (server) => registerCheckRevocationTool(server, 'https://api.example.com', 'bind_sk_secret'),
    );

    const result = await handler({ credentialHash: '0xabc123' });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/credentials/0xabc123/status',
      { method: 'GET', headers: { 'X-API-Key': 'bind_sk_secret' } },
    );
    expect(JSON.parse(result.content[0].text)).toEqual(mockStatus);
  });

  it('returns error on API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    }));

    const handler = captureToolHandler<{ credentialHash: string }>(
      (server) => registerCheckRevocationTool(server, 'https://api.example.com', 'bind_sk_test'),
    );

    const result = await handler({ credentialHash: '0xabc' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toContain('403');
  });
});
