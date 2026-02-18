import { describe, it, expect, vi, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerResolveIssuerTool } from '../../../src/tools/remote/resolveIssuer.js';
import { captureToolHandler } from '../../helpers.js';

describe('registerResolveIssuerTool', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a tool named bind_resolve_issuer', () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    const spy = vi.spyOn(server, 'tool');
    registerResolveIssuerTool(server, 'https://api.example.com', 'idbr_test_key');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toBe('bind_resolve_issuer');
  });

  it('fetches JWKS from the correct URL with auth header', async () => {
    const mockJwks = { keys: [{ kid: 'key1', kty: 'EC' }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockJwks,
    }));

    const handler = captureToolHandler<{ orgId: string }>(
      (server) => registerResolveIssuerTool(server, 'https://api.example.com', 'idbr_test_key'),
    );

    const result = await handler({ orgId: 'test-org' });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/orgs/test-org/.well-known/jwks.json',
      { method: 'GET', headers: { 'X-API-Key': 'idbr_test_key' } },
    );
    expect(JSON.parse(result.content[0].text)).toEqual(mockJwks);
  });

  it('returns error on API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }));

    const handler = captureToolHandler<{ orgId: string }>(
      (server) => registerResolveIssuerTool(server, 'https://api.example.com', 'idbr_test_key'),
    );

    const result = await handler({ orgId: 'missing-org' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toContain('404');
  });
});
