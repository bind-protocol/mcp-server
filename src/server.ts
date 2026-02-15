import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerParseCredentialTool } from './tools/parseCredential.js';
import { registerVerifyCredentialTool } from './tools/verifyCredential.js';
import { registerHashCredentialTool } from './tools/hashCredential.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'bind-protocol',
    version: '0.1.0',
  });

  // Register tools
  registerParseCredentialTool(server);
  registerVerifyCredentialTool(server);
  registerHashCredentialTool(server);

  return server;
}
