import pino from 'pino';

// Stdout is reserved for the MCP stdio transport — all logs go to stderr (fd 2).
// Use synchronous destination to avoid losing messages on sudden process exit.
export const logger = pino(
  { level: process.env.LOG_LEVEL ?? 'info' },
  pino.destination({ dest: 2, sync: true }),
);
