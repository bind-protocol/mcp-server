import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  logger.info('Bind Protocol MCP server starting');
  await server.connect(transport);
  logger.info('Bind Protocol MCP server connected via stdio');
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal error starting MCP server');
  process.exit(1);
});
