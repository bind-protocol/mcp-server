import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchAuthenticated } from '../../src/utils/fetchAuthenticated.js';

describe('fetchAuthenticated', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends X-API-Key header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', mockFetch);

    await fetchAuthenticated('https://api.example.com', '/api/protected', 'bind_sk_test');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/api/protected',
      { method: 'GET', headers: { 'X-API-Key': 'bind_sk_test' } },
    );
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    }));

    await expect(fetchAuthenticated('https://api.example.com', '/api/forbidden', 'bind_sk_test'))
      .rejects.toThrow('Bind API error 403');
  });

  it('sends POST with JSON body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', mockFetch);

    await fetchAuthenticated('https://api.example.com', '/api/resource', 'bind_sk_test', {
      method: 'POST',
      body: { key: 'value' },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/api/resource',
      {
        method: 'POST',
        headers: { 'X-API-Key': 'bind_sk_test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'value' }),
      },
    );
  });

  it('sends DELETE request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', mockFetch);

    await fetchAuthenticated('https://api.example.com', '/api/resource/123', 'bind_sk_test', {
      method: 'DELETE',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/api/resource/123',
      {
        method: 'DELETE',
        headers: { 'X-API-Key': 'bind_sk_test' },
      },
    );
  });

  it('appends query params to URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', mockFetch);

    await fetchAuthenticated('https://api.example.com', '/api/items', 'bind_sk_test', {
      params: { status: 'active', limit: '10' },
    });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/items?');
    expect(calledUrl).toContain('status=active');
    expect(calledUrl).toContain('limit=10');
  });

  it('filters out undefined params', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', mockFetch);

    await fetchAuthenticated('https://api.example.com', '/api/items', 'bind_sk_test', {
      params: { status: 'active', limit: undefined },
    });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('status=active');
    expect(calledUrl).not.toContain('limit');
  });
});
