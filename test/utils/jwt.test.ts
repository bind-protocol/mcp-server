import crypto from 'node:crypto';
import { describe, it, expect } from 'vitest';
import {
  base64UrlEncode,
  base64UrlDecode,
  encodeDerInteger,
  rawToDerSignature,
  parseVCJWT,
  verifyES256Signature,
  extractOrgIdFromKid,
} from '../../src/utils/jwt.js';
import { derToRaw, generateTestKeypair, signTestJWT } from '../helpers.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('base64url', () => {
  it('encodes and decodes a string roundtrip', () => {
    const input = 'Hello, Bind Protocol!';
    const encoded = base64UrlEncode(input);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
    const decoded = base64UrlDecode(encoded).toString('utf8');
    expect(decoded).toBe(input);
  });

  it('handles buffers with special base64 chars', () => {
    const buf = Buffer.from([0xfb, 0xff, 0xfe]);
    const encoded = base64UrlEncode(buf);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    const roundtrip = base64UrlDecode(encoded);
    expect(roundtrip.equals(buf)).toBe(true);
  });
});

describe('encodeDerInteger', () => {
  it('adds leading zero when high bit is set', () => {
    const input = Buffer.from([0x80, 0x01]);
    const result = encodeDerInteger(input);
    expect(result[0]).toBe(0x00);
    expect(result[1]).toBe(0x80);
  });

  it('trims leading zeros', () => {
    const input = Buffer.from([0x00, 0x00, 0x42]);
    const result = encodeDerInteger(input);
    expect(result.length).toBe(1);
    expect(result[0]).toBe(0x42);
  });
});

describe('rawToDerSignature', () => {
  it('produces valid DER that starts with 0x30', () => {
    const raw = crypto.randomBytes(64);
    const der = rawToDerSignature(raw);
    expect(der[0]).toBe(0x30);
  });

  it('roundtrips with derToRaw', () => {
    const original = crypto.randomBytes(64);
    const der = rawToDerSignature(original);
    const back = derToRaw(der);
    expect(back.equals(original)).toBe(true);
  });
});

describe('parseVCJWT', () => {
  it('parses a valid 3-part JWT', () => {
    const header = { alg: 'ES256', kid: 'org1#key1' };
    const payload = { vc: { type: ['VerifiableCredential'] } };

    const jwt = [
      base64UrlEncode(JSON.stringify(header)),
      base64UrlEncode(JSON.stringify(payload)),
      base64UrlEncode(Buffer.from('fakesig')),
    ].join('.');

    const parsed = parseVCJWT(jwt);
    expect(parsed.header.alg).toBe('ES256');
    expect(parsed.header.kid).toBe('org1#key1');
    expect((parsed.payload.vc as Record<string, unknown>).type).toEqual(['VerifiableCredential']);
  });

  it('throws on malformed JWT', () => {
    expect(() => parseVCJWT('only.two')).toThrow('expected 3 dot-separated parts');
    expect(() => parseVCJWT('')).toThrow();
  });
});

describe('verifyES256Signature', () => {
  it('returns true for a correctly signed JWT', () => {
    const { privateKey, jwk } = generateTestKeypair();
    const header = { alg: 'ES256', typ: 'JWT', kid: 'test-org#key1' };
    const payload = { vc: { type: ['VerifiableCredential'] }, iat: 12345 };

    const jwt = signTestJWT(header, payload, privateKey);
    const parsed = parseVCJWT(jwt);

    const valid = verifyES256Signature(parsed.signingInput, parsed.signature, jwk);
    expect(valid).toBe(true);
  });

  it('returns false for a tampered payload', () => {
    const { privateKey, jwk } = generateTestKeypair();
    const header = { alg: 'ES256', typ: 'JWT', kid: 'test-org#key1' };
    const payload = { vc: { type: ['VerifiableCredential'] }, iat: 12345 };

    const jwt = signTestJWT(header, payload, privateKey);
    const parts = jwt.split('.');
    const tamperedPayload = base64UrlEncode(JSON.stringify({ vc: { type: ['Fake'] } }));
    const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    const parsed = parseVCJWT(tampered);

    const valid = verifyES256Signature(parsed.signingInput, parsed.signature, jwk);
    expect(valid).toBe(false);
  });

  it('returns false for a wrong key', () => {
    const kp1 = generateTestKeypair();
    const kp2 = generateTestKeypair();
    const header = { alg: 'ES256', typ: 'JWT', kid: 'test-org#key1' };
    const payload = { vc: { sub: 'alice' } };

    const jwt = signTestJWT(header, payload, kp1.privateKey);
    const parsed = parseVCJWT(jwt);

    const valid = verifyES256Signature(parsed.signingInput, parsed.signature, kp2.jwk);
    expect(valid).toBe(false);
  });
});

describe('extractOrgIdFromKid', () => {
  it('extracts org id before #', () => {
    expect(extractOrgIdFromKid('my-org-123#key-alias')).toBe('my-org-123');
  });

  it('throws when no # present', () => {
    expect(() => extractOrgIdFromKid('no-hash')).toThrow("missing '#'");
  });
});
