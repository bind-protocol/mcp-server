import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { docs } from './docsData.generated.js';

export function registerDocResources(server: McpServer): void {
  for (const doc of docs) {
    const displayName = doc.title || doc.uri;

    server.resource(
      doc.uri,
      doc.uri,
      {
        description: `Bind Protocol documentation: ${displayName}`,
        mimeType: 'text/markdown',
      },
      async () => ({
        contents: [{
          uri: doc.uri,
          mimeType: 'text/markdown',
          text: doc.content,
        }],
      }),
    );
  }
}
