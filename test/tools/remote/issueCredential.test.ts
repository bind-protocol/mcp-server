import { describe, it, expect, vi, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerIssueCredentialTool } from '../../../src/tools/remote/issueCredential.js';
import { captureToolHandler } from '../../helpers.js';

describe('registerIssueCredentialTool', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a tool named bind_issue_credential', () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    const spy = vi.spyOn(server, 'tool');
    registerIssueCredentialTool(server, 'https://api.example.com', 'test_key');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toBe('bind_issue_credential');
  });

  it('issues a credential via POST', async () => {
    const mockCredential = { credential: 'eyJ...' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCredential,
    }));

    const jobId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const handler = captureToolHandler<{ proveJobId: string; format?: string; subjectId?: string; expiresIn?: number }>(
      (server) => registerIssueCredentialTool(server, 'https://api.example.com', 'test_key'),
    );

    const result = await handler({ proveJobId: jobId, format: 'compact' });

    const [calledUrl, calledOpts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toBe(`https://api.example.com/api/prove-jobs/${jobId}/credential`);
    expect(calledOpts.method).toBe('POST');
    expect(calledOpts.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(calledOpts.body)).toEqual({ format: 'compact' });
    expect(JSON.parse(result.content[0].text)).toEqual(mockCredential);
  });

  it('sends minimal body when no optional params provided', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ credential: 'eyJ...' }),
    }));

    const handler = captureToolHandler<{ proveJobId: string; format?: string; subjectId?: string; expiresIn?: number }>(
      (server) => registerIssueCredentialTool(server, 'https://api.example.com', 'test_key'),
    );

    await handler({ proveJobId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' });

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body).toEqual({});
  });

  it('returns error on API failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
    }));

    const handler = captureToolHandler<{ proveJobId: string }>(
      (server) => registerIssueCredentialTool(server, 'https://api.example.com', 'test_key'),
    );

    const result = await handler({ proveJobId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' });
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text).error).toContain('409');
  });
});
