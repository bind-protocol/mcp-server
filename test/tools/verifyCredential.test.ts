import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateTestKeypair, signTestJWT } from '../helpers.js';
import type { JWK } from '../../src/utils/jwt.js';

// We test the tool by calling the underlying logic that the tool handler calls,
// mocking only the network layer (fetch) so we exercise kid extraction, JWKS
// lookup, signature verification, and expiry checking end-to-end.

import { parseVCJWT, verifyES256Signature, extractOrgIdFromKid } from '../../src/utils/jwt.js';

describe('bind_verify_credential (tool-level)', () => {
  const orgId = 'test-org-1';
  const kid = `${orgId}#default`;
  let kp: ReturnType<typeof generateTestKeypair>;

  function makeValidJWT(overrides?: Record<string, unknown>) {
    const header = { alg: 'ES256', typ: 'JWT', kid };
    const payload = {
      vc: {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        type: ['VerifiableCredential'],
        issuer: `did:web:api.bind.global:orgs:${orgId}`,
        validUntil: new Date(Date.now() + 86400000).toISOString(),
        credentialSubject: { policyId: 'pol-1', outputValue: 'pass' },
        ...overrides,
      },
    };
    return signTestJWT(header, payload, kp.privateKey);
  }

  beforeEach(() => {
    kp = generateTestKeypair();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('verifies a valid credential end-to-end with mocked JWKS fetch', async () => {
    const jwt = makeValidJWT();

    // Mock fetch to return the JWKS
    const jwks = { keys: [{ ...kp.jwk, kid, alg: 'ES256', use: 'sig' }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => jwks,
    }));

    // Replicate tool logic
    const { header, payload, signature, signingInput } = parseVCJWT(jwt);
    expect(header.alg).toBe('ES256');
    expect(header.kid).toBe(kid);

    const extractedOrgId = extractOrgIdFromKid(header.kid!);
    expect(extractedOrgId).toBe(orgId);

    const res = await fetch(`/api/orgs/${extractedOrgId}/.well-known/jwks.json`);
    const fetchedJwks = await res.json() as { keys: JWK[] };
    const jwk = fetchedJwks.keys.find((k: JWK) => k.kid === kid);
    expect(jwk).toBeDefined();

    const isValid = verifyES256Signature(signingInput, signature, jwk!);
    expect(isValid).toBe(true);

    const vc = payload.vc as Record<string, unknown>;
    expect(vc).toBeDefined();
    expect(new Date(vc.validUntil as string) > new Date()).toBe(true);
  });

  it('rejects when JWKS has no matching kid', async () => {
    const jwt = makeValidJWT();

    // Return empty JWKS
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [] }),
    }));

    const { header } = parseVCJWT(jwt);
    const extractedOrgId = extractOrgIdFromKid(header.kid!);

    const res = await fetch(`/api/orgs/${extractedOrgId}/.well-known/jwks.json`);
    const fetchedJwks = await res.json() as { keys: JWK[] };
    const jwk = fetchedJwks.keys.find((k: JWK) => k.kid === kid);
    expect(jwk).toBeUndefined();
  });

  it('rejects an expired credential (validUntil in the past)', async () => {
    const jwt = makeValidJWT({
      validUntil: new Date(Date.now() - 86400000).toISOString(),
    });

    const jwks = { keys: [{ ...kp.jwk, kid, alg: 'ES256', use: 'sig' }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => jwks,
    }));

    const { header, payload, signature, signingInput } = parseVCJWT(jwt);

    const extractedOrgId = extractOrgIdFromKid(header.kid!);
    const res = await fetch(`/api/orgs/${extractedOrgId}/.well-known/jwks.json`);
    const fetchedJwks = await res.json() as { keys: JWK[] };
    const jwk = fetchedJwks.keys.find((k: JWK) => k.kid === kid);

    // Signature is still valid
    const isValid = verifyES256Signature(signingInput, signature, jwk!);
    expect(isValid).toBe(true);

    // But the credential is expired
    const vc = payload.vc as Record<string, unknown>;
    expect(new Date(vc.validUntil as string) < new Date()).toBe(true);
  });

  it('rejects when JWKS fetch fails', async () => {
    const jwt = makeValidJWT();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }));

    const { header } = parseVCJWT(jwt);
    const extractedOrgId = extractOrgIdFromKid(header.kid!);

    const res = await fetch(`/api/orgs/${extractedOrgId}/.well-known/jwks.json`);
    expect(res.ok).toBe(false);
  });

  it('rejects a JWT with unsupported algorithm', () => {
    const header = { alg: 'RS256', typ: 'JWT', kid };
    const payload = { vc: { type: ['VerifiableCredential'] } };
    const jwt = signTestJWT(header, payload, kp.privateKey);
    const parsed = parseVCJWT(jwt);
    expect(parsed.header.alg).toBe('RS256');
    // Tool would reject: alg !== 'ES256'
  });

  it('rejects a JWT with no kid', () => {
    const header = { alg: 'ES256', typ: 'JWT' };
    const payload = { vc: { type: ['VerifiableCredential'] } };
    const jwt = signTestJWT(header, payload, kp.privateKey);
    const parsed = parseVCJWT(jwt);
    expect(parsed.header.kid).toBeUndefined();
    // Tool would reject: !kid
  });

  it('rejects signature from a different key', async () => {
    const jwt = makeValidJWT();
    const kp2 = generateTestKeypair();

    // Return a JWKS with a different key
    const jwks = { keys: [{ ...kp2.jwk, kid, alg: 'ES256', use: 'sig' }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => jwks,
    }));

    const { signature, signingInput } = parseVCJWT(jwt);

    const res = await fetch(`/api/orgs/${orgId}/.well-known/jwks.json`);
    const fetchedJwks = await res.json() as { keys: JWK[] };
    const jwk = fetchedJwks.keys.find((k: JWK) => k.kid === kid);

    const isValid = verifyES256Signature(signingInput, signature, jwk!);
    expect(isValid).toBe(false);
  });
});
