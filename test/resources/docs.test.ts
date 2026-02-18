import { describe, it, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerDocResources } from '../../src/resources/docs.js';

describe('registerDocResources', () => {
  it('registers one resource per doc entry', () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    const spy = vi.spyOn(server, 'resource');

    registerDocResources(server);

    expect(spy.mock.calls.length).toBeGreaterThan(0);
  });

  it('uses bind:// URI scheme for all resources', () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    const spy = vi.spyOn(server, 'resource');

    registerDocResources(server);

    for (const call of spy.mock.calls) {
      const uri = call[1] as string;
      expect(uri).toMatch(/^bind:\/\/docs\//);
    }
  });

  it('sets mimeType to text/markdown', () => {
    const server = new McpServer({ name: 'test', version: '0.0.1' });
    const spy = vi.spyOn(server, 'resource');

    registerDocResources(server);

    for (const call of spy.mock.calls) {
      const opts = call[2] as { mimeType: string };
      expect(opts.mimeType).toBe('text/markdown');
    }
  });
});
