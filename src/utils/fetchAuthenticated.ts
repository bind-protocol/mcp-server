export interface FetchOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | undefined>;
}

/** Fetch an authenticated Bind API endpoint (uses caller-provided API key). */
export async function fetchAuthenticated(
  apiUrl: string,
  path: string,
  apiKey: string,
  options?: FetchOptions,
): Promise<Response> {
  const { method = 'GET', body, params } = options ?? {};

  let url = `${apiUrl}${path}`;
  if (params) {
    const filtered = Object.entries(params).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    );
    if (filtered.length > 0) {
      url += `?${new URLSearchParams(filtered).toString()}`;
    }
  }

  const headers: Record<string, string> = { 'X-API-Key': apiKey };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    throw new Error(`Bind API error ${res.status}: ${res.statusText} (${url})`);
  }
  return res;
}
