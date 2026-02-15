import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { parseVCJWT, verifyES256Signature, extractOrgIdFromKid } from '../utils/jwt.js';
import type { JWK } from '../utils/jwt.js';
import { fetchPublic } from '../utils/http.js';
import { logger } from '../utils/logger.js';

export function registerVerifyCredentialTool(server: McpServer): void {
  server.tool(
    'bind_verify_credential',
    'Verify a Bind Protocol VC-JWT: parse the JWT, fetch the issuer JWKS, verify the ES256 signature, and check expiration. Does NOT check revocation status — use bind_check_revocation separately for that. Returns the verified claims on success.',
    { jwt: z.string().describe('The VC-JWT string to verify') },
    async ({ jwt }) => {
      try {
        // 1. Parse JWT
        const { header, payload, signature, signingInput } = parseVCJWT(jwt);

        if (header.alg !== 'ES256') {
          throw new Error(`Unsupported algorithm: ${header.alg}. Only ES256 is supported.`);
        }

        const kid = header.kid;
        if (!kid) {
          throw new Error('JWT missing kid in header');
        }

        // 2. Resolve org's JWKS
        const orgId = extractOrgIdFromKid(kid);
        const jwksRes = await fetchPublic(`/api/orgs/${orgId}/.well-known/jwks.json`);
        const jwks = await jwksRes.json() as { keys: JWK[] };

        // 3. Find the matching key
        const jwk = jwks.keys.find((k: JWK) => k.kid === kid);
        if (!jwk) {
          throw new Error(`Public key not found for kid: ${kid}`);
        }

        // 4. Verify signature
        const isValid = verifyES256Signature(signingInput, signature, jwk);
        if (!isValid) {
          throw new Error('Invalid signature');
        }

        // 5. Check expiration
        const vc = payload.vc as Record<string, unknown> | undefined;
        if (!vc) {
          throw new Error('Invalid JWT payload: missing vc claim');
        }

        if (vc.validUntil && new Date(vc.validUntil as string) < new Date()) {
          throw new Error('Credential expired');
        }

        const exp = payload.exp as number | undefined;
        if (exp && exp < Math.floor(Date.now() / 1000)) {
          throw new Error('Credential expired (exp claim)');
        }

        logger.info({ kid, orgId }, 'Credential verified');

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              valid: true,
              issuer: vc.issuer,
              kid,
              claims: vc,
            }, null, 2),
          }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ valid: false, error: message }) }],
          isError: true,
        };
      }
    },
  );
}
