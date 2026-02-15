import { describe, it, expect, vi, afterEach } from 'vitest';
import { getConfig, fetchPublic } from '../../src/utils/http.js';

describe('getConfig', () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('returns defaults when env vars are not set', () => {
    delete process.env.BIND_API_URL;
    const config = getConfig();
    expect(config.apiUrl).toBe('https://api.bindprotocol.xyz');
  });

  it('reads env vars when set', () => {
    process.env.BIND_API_URL = 'https://custom.api';
    const config = getConfig();
    expect(config.apiUrl).toBe('https://custom.api');
  });
});

describe('fetchPublic', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls fetch without auth headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', mockFetch);

    await fetchPublic('/api/test');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/test');
    expect(options).toBeUndefined();
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }));

    await expect(fetchPublic('/api/missing')).rejects.toThrow('Bind API error 404');
  });
});
