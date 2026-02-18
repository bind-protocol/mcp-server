import { describe, it, expect, vi, afterEach } from 'vitest';

/** Helper to get tool names from McpServer's internal registry (plain object). */
function getToolNames(server: unknown): string[] {
  const tools = (server as any)._registeredTools as Record<string, unknown>;
  return Object.keys(tools);
}

describe('createServer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.BIND_API_KEY;
    delete process.env.BIND_API_URL;
  });

  it('registers zero remote tools for a regular API key (idbr_ prefix)', async () => {
    vi.stubGlobal('fetch', vi.fn());
    process.env.BIND_API_KEY = 'idbr_abcdefghijk_somesecretvalue';

    const { createServer } = await import('../src/server.js');
    const server = await createServer();

    const toolNames = getToolNames(server);

    const remoteToolNames = [
      'bind_resolve_issuer',
      'bind_explain_policy',
      'bind_check_revocation',
      'bind_list_policies',
      'bind_list_circuits',
      'bind_submit_prove_job',
      'bind_get_prove_job',
      'bind_list_prove_jobs',
      'bind_issue_credential',
      'bind_share_proof',
      'bind_list_shared_proofs',
      'bind_whoami',
      'bind_create_policy',
      'bind_validate_policy',
      'bind_generate_circuit',
      'bind_get_circuit_status',
    ];

    for (const remoteTool of remoteToolNames) {
      expect(toolNames).not.toContain(remoteTool);
    }

    // Local tools should still be registered
    expect(toolNames).toContain('bind_parse_credential');
    expect(toolNames).toContain('bind_verify_credential');
    expect(toolNames).toContain('bind_hash_credential');
  });

  it('registers remote tools for an agent key after successful validation', async () => {
    process.env.BIND_API_KEY = 'idbr_agent_abcdefghijk_somesecretvalue';
    process.env.BIND_API_URL = 'https://api.test.local';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          allowedTools: ['bind_resolve_issuer', 'bind_whoami'],
        },
      }),
    }));

    const { createServer } = await import('../src/server.js');
    const server = await createServer();

    const toolNames = getToolNames(server);

    expect(toolNames).toContain('bind_resolve_issuer');
    expect(toolNames).toContain('bind_whoami');
    expect(toolNames).not.toContain('bind_issue_credential');
  });

  it('registers no remote tools when no API key is set', async () => {
    vi.stubGlobal('fetch', vi.fn());
    delete process.env.BIND_API_KEY;

    const { createServer } = await import('../src/server.js');
    const server = await createServer();

    const toolNames = getToolNames(server);

    // Local tools + receipt tools (record, list, verify_chain, summary)
    expect(toolNames).toContain('bind_parse_credential');
    expect(toolNames).toContain('bind_verify_credential');
    expect(toolNames).toContain('bind_hash_credential');

    // No remote tools
    expect(toolNames).not.toContain('bind_resolve_issuer');
    expect(toolNames).not.toContain('bind_whoami');
  });
});
