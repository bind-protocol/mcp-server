import { describe, it, expect } from 'vitest';
import { base64UrlEncode } from '../../src/utils/jwt.js';
import { parseVCJWT } from '../../src/utils/jwt.js';

function makeJWT(header: Record<string, unknown>, payload: Record<string, unknown>, sig = 'test-sig'): string {
  return [
    base64UrlEncode(JSON.stringify(header)),
    base64UrlEncode(JSON.stringify(payload)),
    base64UrlEncode(Buffer.from(sig)),
  ].join('.');
}

describe('bind_parse_credential (unit)', () => {
  it('decodes a well-formed VC-JWT', () => {
    const header = { alg: 'ES256', typ: 'JWT', kid: 'org-1#default' };
    const payload = {
      vc: {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        type: ['VerifiableCredential', 'BindCredential'],
        issuer: 'did:web:api.bind.global:orgs:org-1',
        credentialSubject: { policyId: 'pol-1', outputValue: 42 },
      },
    };

    const jwt = makeJWT(header, payload);
    const parsed = parseVCJWT(jwt);

    expect(parsed.header.alg).toBe('ES256');
    expect(parsed.header.kid).toBe('org-1#default');
    expect(parsed.payload.vc).toBeDefined();
    const vc = parsed.payload.vc as Record<string, unknown>;
    expect(vc.type).toEqual(['VerifiableCredential', 'BindCredential']);
  });

  it('throws on a JWT with only 2 parts', () => {
    expect(() => parseVCJWT('part1.part2')).toThrow('expected 3 dot-separated parts');
  });

  it('throws on empty string', () => {
    expect(() => parseVCJWT('')).toThrow();
  });

  it('throws on a JWT with invalid JSON in header', () => {
    const jwt = `${base64UrlEncode('not-json')}.${base64UrlEncode('{}')}.${base64UrlEncode('sig')}`;
    expect(() => parseVCJWT(jwt)).toThrow();
  });
});
