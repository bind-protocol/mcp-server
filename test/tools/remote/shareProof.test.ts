import { describe, it, expect, vi, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerShareProofTool } from '../../../src/tools/remote/shareProof.js';
import { captureToolHandler } from '../../helpers.js';

describe('registerShareProofTool', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a tool named bind_share_proof', () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    const spy = vi.spyOn(server, 'tool');
    registerShareProofTool(server, 'https://api.example.com', 'test_key');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toBe('bind_share_proof');
  });

  it('shares a proof via POST', async () => {
    const mockResponse = { id: 'sp-1', status: 'shared' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }));

    const handler = captureToolHandler<{ proveJobId: string; verifierOrgId: string; expiresAt?: string; note?: string }>(
      (server) => registerShareProofTool(server, 'https://api.example.com', 'test_key'),
    );

    const result = await handler({
      proveJobId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      verifierOrgId: 'verifier-org',
      note: 'For review',
    });

    const [calledUrl, calledOpts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toBe('https://api.example.com/api/shared-proofs');
    expect(calledOpts.method).toBe('POST');
    expect(calledOpts.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(calledOpts.body);
    expect(body.proveJobId).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(body.verifierOrgId).toBe('verifier-org');
    expect(body.note).toBe('For review');
    expect(JSON.parse(result.content[0].text)).toEqual(mockResponse);
  });

  it('returns error on API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
    }));

    const handler = captureToolHandler<{ proveJobId: string; verifierOrgId: string }>(
      (server) => registerShareProofTool(server, 'https://api.example.com', 'test_key'),
    );

    const result = await handler({
      proveJobId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      verifierOrgId: 'verifier-org',
    });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toContain('422');
  });
});
