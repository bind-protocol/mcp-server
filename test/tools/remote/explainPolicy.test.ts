import { describe, it, expect, vi, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerExplainPolicyTool } from '../../../src/tools/remote/explainPolicy.js';
import { captureToolHandler } from '../../helpers.js';

describe('registerExplainPolicyTool', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a tool named bind_explain_policy', () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    const spy = vi.spyOn(server, 'tool');
    registerExplainPolicyTool(server, 'https://api.example.com', 'idbr_test_key');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toBe('bind_explain_policy');
  });

  it('fetches policy from the correct URL with auth header', async () => {
    const mockPolicy = { id: 'kyc-basic', claims: ['name', 'dob'] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPolicy,
    }));

    const handler = captureToolHandler<{ policyId: string }>(
      (server) => registerExplainPolicyTool(server, 'https://api.example.com', 'idbr_test_key'),
    );

    const result = await handler({ policyId: 'kyc-basic' });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/api/policies/kyc-basic',
      { method: 'GET', headers: { 'X-API-Key': 'idbr_test_key' } },
    );
    expect(JSON.parse(result.content[0].text)).toEqual(mockPolicy);
  });

  it('returns error on API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }));

    const handler = captureToolHandler<{ policyId: string }>(
      (server) => registerExplainPolicyTool(server, 'https://api.example.com', 'idbr_test_key'),
    );

    const result = await handler({ policyId: 'bad' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toContain('500');
  });
});
