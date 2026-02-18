import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { ulid } from 'ulid';
import type Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';

const esmRequire = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Receipt {
  id: string;
  tool: string;
  action: 'invoke' | 'block';
  inputHash: string;
  outputHash: string;
  success: boolean;
  policyRef: string | null;
  apiKeyPrefix: string | null;
  timestamp: string;
  durationMs: number;
  prevHash: string;
  receiptHash: string;
}

export interface RecordInput {
  tool: string;
  action: 'invoke' | 'block';
  inputHash: string;
  outputHash: string;
  success: boolean;
  policyRef?: string;
  apiKeyPrefix?: string;
  durationMs: number;
}

export interface ListOptions {
  tool?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

export interface ChainVerification {
  valid: boolean;
  receiptsChecked: number;
  brokenAt?: string;
}

export interface ReceiptSummary {
  total: number;
  byTool: Record<string, number>;
  successRate: number;
  chainValid: boolean;
  firstTimestamp?: string;
  lastTimestamp?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GENESIS = 'GENESIS';

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  tool TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('invoke', 'block')),
  input_hash TEXT NOT NULL,
  output_hash TEXT NOT NULL,
  success INTEGER NOT NULL,
  policy_ref TEXT,
  api_key_prefix TEXT,
  timestamp TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  prev_hash TEXT NOT NULL,
  receipt_hash TEXT NOT NULL
)`;

const CREATE_INDEX_TOOL = `CREATE INDEX IF NOT EXISTS idx_receipts_tool ON receipts(tool)`;
const CREATE_INDEX_TS = `CREATE INDEX IF NOT EXISTS idx_receipts_timestamp ON receipts(timestamp)`;

// ---------------------------------------------------------------------------
// Hash helper
// ---------------------------------------------------------------------------

function computeReceiptHash(
  id: string,
  tool: string,
  action: string,
  inputHash: string,
  outputHash: string,
  success: boolean,
  timestamp: string,
  prevHash: string,
): string {
  const data = `${id}|${tool}|${action}|${inputHash}|${outputHash}|${success}|${timestamp}|${prevHash}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ---------------------------------------------------------------------------
// Default DB path
// ---------------------------------------------------------------------------

function defaultDbPath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '.';
  return path.join(home, '.bind', 'receipts.db');
}

// ---------------------------------------------------------------------------
// ReceiptStore
// ---------------------------------------------------------------------------

export class ReceiptStore {
  private db: Database.Database;
  private lastHash: string = GENESIS;
  private insertStmt: Database.Statement;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? process.env.BIND_RECEIPTS_PATH ?? defaultDbPath();

    // Ensure directory exists
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

    // Dynamic require for native module (CJS-only, not bundlable)
    const SqliteDatabase = esmRequire('better-sqlite3') as typeof import('better-sqlite3').default;
    this.db = new SqliteDatabase(resolvedPath);

    // Enable WAL mode for better concurrent read performance
    this.db.pragma('journal_mode = WAL');

    // Create schema
    this.db.exec(CREATE_TABLE);
    this.db.exec(CREATE_INDEX_TOOL);
    this.db.exec(CREATE_INDEX_TS);

    // Recover lastHash from the last row
    const lastRow = this.db
      .prepare('SELECT receipt_hash FROM receipts ORDER BY rowid DESC LIMIT 1')
      .get() as { receipt_hash: string } | undefined;
    if (lastRow) {
      this.lastHash = lastRow.receipt_hash;
    }

    // Prepare insert statement
    this.insertStmt = this.db.prepare(`
      INSERT INTO receipts (id, tool, action, input_hash, output_hash, success, policy_ref, api_key_prefix, timestamp, duration_ms, prev_hash, receipt_hash)
      VALUES (@id, @tool, @action, @inputHash, @outputHash, @success, @policyRef, @apiKeyPrefix, @timestamp, @durationMs, @prevHash, @receiptHash)
    `);

    logger.debug({ path: resolvedPath }, 'Receipt store initialized');
  }

  record(input: RecordInput): Receipt {
    const id = ulid();
    const timestamp = new Date().toISOString();
    const prevHash = this.lastHash;

    const receiptHash = computeReceiptHash(
      id,
      input.tool,
      input.action,
      input.inputHash,
      input.outputHash,
      input.success,
      timestamp,
      prevHash,
    );

    const receipt: Receipt = {
      id,
      tool: input.tool,
      action: input.action,
      inputHash: input.inputHash,
      outputHash: input.outputHash,
      success: input.success,
      policyRef: input.policyRef ?? null,
      apiKeyPrefix: input.apiKeyPrefix ?? null,
      timestamp,
      durationMs: input.durationMs,
      prevHash,
      receiptHash,
    };

    this.insertStmt.run({
      ...receipt,
      success: receipt.success ? 1 : 0,
    });
    this.lastHash = receiptHash;

    return receipt;
  }

  list(options?: ListOptions): Receipt[] {
    const conditions: string[] = [];
    const params: Record<string, string | number> = {};

    if (options?.tool) {
      conditions.push('tool = @tool');
      params.tool = options.tool;
    }
    if (options?.since) {
      conditions.push('timestamp >= @since');
      params.since = options.since;
    }
    if (options?.until) {
      conditions.push('timestamp <= @until');
      params.until = options.until;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(Math.max(options?.limit ?? 100, 1), 1000);
    const offset = Math.max(options?.offset ?? 0, 0);

    const rows = this.db
      .prepare(
        `SELECT id, tool, action, input_hash, output_hash, success, policy_ref, api_key_prefix, timestamp, duration_ms, prev_hash, receipt_hash
         FROM receipts ${where}
         ORDER BY rowid ASC
         LIMIT @limit OFFSET @offset`,
      )
      .all({ ...params, limit, offset }) as Array<{
        id: string;
        tool: string;
        action: 'invoke' | 'block';
        input_hash: string;
        output_hash: string;
        success: number;
        policy_ref: string | null;
        api_key_prefix: string | null;
        timestamp: string;
        duration_ms: number;
        prev_hash: string;
        receipt_hash: string;
      }>;

    return rows.map((r) => ({
      id: r.id,
      tool: r.tool,
      action: r.action,
      inputHash: r.input_hash,
      outputHash: r.output_hash,
      success: r.success === 1,
      policyRef: r.policy_ref,
      apiKeyPrefix: r.api_key_prefix,
      timestamp: r.timestamp,
      durationMs: r.duration_ms,
      prevHash: r.prev_hash,
      receiptHash: r.receipt_hash,
    }));
  }

  verifyChain(): ChainVerification {
    const rows = this.db
      .prepare(
        `SELECT id, tool, action, input_hash, output_hash, success, timestamp, prev_hash, receipt_hash
         FROM receipts ORDER BY rowid ASC`,
      )
      .all() as Array<{
        id: string;
        tool: string;
        action: string;
        input_hash: string;
        output_hash: string;
        success: number;
        timestamp: string;
        prev_hash: string;
        receipt_hash: string;
      }>;

    let expectedPrev = GENESIS;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Verify prev_hash links correctly
      if (row.prev_hash !== expectedPrev) {
        return { valid: false, receiptsChecked: i, brokenAt: row.id };
      }

      // Recompute hash and verify
      const recomputed = computeReceiptHash(
        row.id,
        row.tool,
        row.action,
        row.input_hash,
        row.output_hash,
        row.success === 1,
        row.timestamp,
        row.prev_hash,
      );

      if (recomputed !== row.receipt_hash) {
        return { valid: false, receiptsChecked: i, brokenAt: row.id };
      }

      expectedPrev = row.receipt_hash;
    }

    return { valid: true, receiptsChecked: rows.length };
  }

  summary(): ReceiptSummary {
    const total = (
      this.db.prepare('SELECT COUNT(*) as count FROM receipts').get() as { count: number }
    ).count;

    if (total === 0) {
      return { total: 0, byTool: {}, successRate: 1, chainValid: true };
    }

    const byToolRows = this.db
      .prepare('SELECT tool, COUNT(*) as count FROM receipts GROUP BY tool')
      .all() as Array<{ tool: string; count: number }>;

    const byTool: Record<string, number> = {};
    for (const row of byToolRows) {
      byTool[row.tool] = row.count;
    }

    const successCount = (
      this.db.prepare('SELECT COUNT(*) as count FROM receipts WHERE success = 1').get() as {
        count: number;
      }
    ).count;

    const timestamps = this.db
      .prepare(
        'SELECT MIN(timestamp) as first, MAX(timestamp) as last FROM receipts',
      )
      .get() as { first: string; last: string };

    const { valid: chainValid } = this.verifyChain();

    return {
      total,
      byTool,
      successRate: successCount / total,
      chainValid,
      firstTimestamp: timestamps.first,
      lastTimestamp: timestamps.last,
    };
  }

  close(): void {
    this.db.close();
  }
}
