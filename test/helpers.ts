import crypto from 'node:crypto';
import { vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { base64UrlEncode } from '../src/utils/jwt.js';

/** Convert DER signature to raw 64-byte r||s format. */
export function derToRaw(der: Buffer): Buffer {
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error('bad DER');
  let seqLen = der[offset++];
  if (seqLen & 0x80) {
    const n = seqLen & 0x7f;
    seqLen = 0;
    for (let i = 0; i < n; i++) seqLen = (seqLen << 8) | der[offset++];
  }

  function readInt(): Buffer {
    if (der[offset++] !== 0x02) throw new Error('bad DER int');
    let len = der[offset++];
    if (len & 0x80) {
      const n = len & 0x7f;
      len = 0;
      for (let i = 0; i < n; i++) len = (len << 8) | der[offset++];
    }
    let bytes = der.slice(offset, offset + len);
    offset += len;
    if (bytes.length > 0 && bytes[0] === 0x00 && bytes.length > 1) bytes = bytes.slice(1);
    const padded = Buffer.alloc(32);
    bytes.copy(padded, 32 - bytes.length);
    return padded;
  }

  return Buffer.concat([readInt(), readInt()]);
}

/** Generate a P-256 keypair and return the JWK public key alongside the key objects. */
export function generateTestKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  const jwk = publicKey.export({ format: 'jwk' }) as {
    kty: string;
    crv: string;
    x: string;
    y: string;
  };
  return { publicKey, privateKey, jwk };
}

/** Sign a JWT with the given header/payload using a P-256 private key. */
export function signTestJWT(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKey: crypto.KeyObject,
): string {
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const sign = crypto.createSign('SHA256');
  sign.update(signingInput);
  const derSig = sign.sign(privateKey);
  const rawSig = derToRaw(derSig);
  const sigB64 = base64UrlEncode(rawSig);

  return `${signingInput}.${sigB64}`;
}

/**
 * Captures the tool handler registered via `server.tool()`.
 * Returns the handler function so tests can call it directly
 * without depending on McpServer internals.
 */
export function captureToolHandler<TArgs>(
  register: (server: McpServer) => void,
): (args: TArgs) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
  const server = new McpServer({ name: 'test', version: '0.0.1' });
  let handler: ((args: TArgs) => Promise<unknown>) | undefined;

  vi.spyOn(server, 'tool').mockImplementation(
    (_name: unknown, _desc: unknown, _schema: unknown, fn: unknown) => {
      handler = fn as typeof handler;
    },
  );

  register(server);

  if (!handler) {
    throw new Error('Tool handler was not captured — register function did not call server.tool()');
  }

  return handler as ReturnType<typeof captureToolHandler<TArgs>>;
}
