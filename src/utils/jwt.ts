import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Base64url
// ---------------------------------------------------------------------------

export function base64UrlEncode(input: string | Buffer): string {
  const buffer = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function base64UrlDecode(str: string): Buffer {
  return Buffer.from(
    str.replace(/-/g, '+').replace(/_/g, '/'),
    'base64',
  );
}

// ---------------------------------------------------------------------------
// DER encoding helpers (mirrors api/src/services/VCSigningService.ts)
// ---------------------------------------------------------------------------

/** Encode a big-endian unsigned integer for DER: trim leading zeros, add 0x00 if high bit set. */
export function encodeDerInteger(bytes: Buffer): Buffer {
  let trimmed = bytes;
  while (trimmed.length > 1 && trimmed[0] === 0 && (trimmed[1] & 0x80) === 0) {
    trimmed = trimmed.slice(1);
  }
  if (trimmed[0] & 0x80) {
    trimmed = Buffer.concat([Buffer.from([0x00]), trimmed]);
  }
  return trimmed;
}

/** Convert a 64-byte raw ES256 signature (r‖s) to DER format for Node crypto.verify. */
export function rawToDerSignature(raw: Buffer): Buffer {
  const r = raw.slice(0, 32);
  const s = raw.slice(32, 64);
  const rDer = encodeDerInteger(r);
  const sDer = encodeDerInteger(s);

  return Buffer.concat([
    Buffer.from([0x30]),                           // SEQUENCE
    Buffer.from([2 + rDer.length + 2 + sDer.length]), // total length
    Buffer.from([0x02]),                           // INTEGER tag
    Buffer.from([rDer.length]),                    // r length
    rDer,
    Buffer.from([0x02]),                           // INTEGER tag
    Buffer.from([sDer.length]),                    // s length
    sDer,
  ]);
}

// ---------------------------------------------------------------------------
// JWT parsing
// ---------------------------------------------------------------------------

export interface JWTHeader {
  alg: string;
  typ?: string;
  kid?: string;
  [key: string]: unknown;
}

export interface ParsedJWT {
  header: JWTHeader;
  payload: Record<string, unknown>;
  signature: Buffer;
  signingInput: string;
}

/** Decode a VC-JWT into its constituent parts. No signature verification. */
export function parseVCJWT(jwt: string): ParsedJWT {
  const parts = jwt.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format: expected 3 dot-separated parts');
  }

  const [headerPart, payloadPart, signaturePart] = parts;

  const header: JWTHeader = JSON.parse(base64UrlDecode(headerPart).toString('utf8'));
  const payload: Record<string, unknown> = JSON.parse(base64UrlDecode(payloadPart).toString('utf8'));
  const signature = base64UrlDecode(signaturePart);
  const signingInput = `${headerPart}.${payloadPart}`;

  return { header, payload, signature, signingInput };
}

// ---------------------------------------------------------------------------
// ES256 signature verification  (pattern from proofCredentialService.ts:543-583)
// ---------------------------------------------------------------------------

export interface JWK {
  kty: string;
  crv: string;
  x: string;
  y: string;
  kid?: string;
  use?: string;
  alg?: string;
}

/** Verify an ES256 (P-256 + SHA-256) JWT signature given the issuer's JWK. */
export function verifyES256Signature(signingInput: string, rawSignature: Buffer, jwk: JWK): boolean {
  const derSignature = rawToDerSignature(rawSignature);

  const ec = crypto.createPublicKey({
    key: {
      crv: jwk.crv,
      kty: 'EC',
      x: jwk.x,
      y: jwk.y,
    },
    format: 'jwk',
  });

  const verify = crypto.createVerify('SHA256');
  verify.update(signingInput);
  return verify.verify(ec, derSignature);
}

// ---------------------------------------------------------------------------
// kid / DID helpers
// ---------------------------------------------------------------------------

/** Extract the orgId portion from a kid like "orgId#keyAlias". */
export function extractOrgIdFromKid(kid: string): string {
  const hashIndex = kid.indexOf('#');
  if (hashIndex === -1) {
    throw new Error(`Invalid kid format (missing '#'): ${kid}`);
  }
  return kid.substring(0, hashIndex);
}

