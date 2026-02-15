import { logger } from './logger.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface BindConfig {
  apiUrl: string;
}

export function getConfig(): BindConfig {
  return {
    apiUrl: process.env.BIND_API_URL ?? 'https://api.bindprotocol.xyz',
  };
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

/** Fetch a public (unauthenticated) Bind API endpoint. */
export async function fetchPublic(path: string): Promise<Response> {
  const { apiUrl } = getConfig();
  const url = `${apiUrl}${path}`;
  logger.debug({ url }, 'fetchPublic');
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Bind API error ${res.status}: ${res.statusText} (${url})`);
  }
  return res;
}
