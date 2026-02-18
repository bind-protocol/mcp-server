import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ReceiptStore } from '../../src/receipts/store.js';

function tempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bind-receipts-test-'));
  return path.join(dir, 'test.db');
}

describe('ReceiptStore', () => {
  const stores: ReceiptStore[] = [];

  function createStore(dbPath?: string): ReceiptStore {
    const store = new ReceiptStore(dbPath ?? tempDbPath());
    stores.push(store);
    return store;
  }

  afterEach(() => {
    for (const store of stores) {
      try { store.close(); } catch { /* ignore */ }
    }
    stores.length = 0;
  });

  it('creates database and records a receipt', () => {
    const store = createStore();
    const receipt = store.record({
      tool: 'bind_parse_credential',
      action: 'invoke',
      inputHash: 'abc123',
      outputHash: 'def456',
      success: true,
      durationMs: 42,
    });

    expect(receipt.id).toBeTruthy();
    expect(receipt.tool).toBe('bind_parse_credential');
    expect(receipt.action).toBe('invoke');
    expect(receipt.success).toBe(true);
    expect(receipt.prevHash).toBe('GENESIS');
    expect(receipt.receiptHash).toBeTruthy();
    expect(receipt.durationMs).toBe(42);
  });

  it('chains receipts with prev_hash linkage', () => {
    const store = createStore();

    const r1 = store.record({
      tool: 'tool_a',
      action: 'invoke',
      inputHash: 'i1',
      outputHash: 'o1',
      success: true,
      durationMs: 10,
    });

    const r2 = store.record({
      tool: 'tool_b',
      action: 'invoke',
      inputHash: 'i2',
      outputHash: 'o2',
      success: true,
      durationMs: 20,
    });

    expect(r1.prevHash).toBe('GENESIS');
    expect(r2.prevHash).toBe(r1.receiptHash);
  });

  it('lists receipts in order', () => {
    const store = createStore();

    store.record({ tool: 'a', action: 'invoke', inputHash: '1', outputHash: '1', success: true, durationMs: 1 });
    store.record({ tool: 'b', action: 'invoke', inputHash: '2', outputHash: '2', success: false, durationMs: 2 });
    store.record({ tool: 'a', action: 'block', inputHash: '3', outputHash: '3', success: true, durationMs: 3 });

    const all = store.list();
    expect(all).toHaveLength(3);
    expect(all[0].tool).toBe('a');
    expect(all[1].tool).toBe('b');
    expect(all[2].action).toBe('block');
  });

  it('filters by tool name', () => {
    const store = createStore();

    store.record({ tool: 'a', action: 'invoke', inputHash: '1', outputHash: '1', success: true, durationMs: 1 });
    store.record({ tool: 'b', action: 'invoke', inputHash: '2', outputHash: '2', success: true, durationMs: 2 });

    const filtered = store.list({ tool: 'a' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].tool).toBe('a');
  });

  it('supports limit and offset', () => {
    const store = createStore();

    for (let i = 0; i < 5; i++) {
      store.record({ tool: `t${i}`, action: 'invoke', inputHash: `i${i}`, outputHash: `o${i}`, success: true, durationMs: i });
    }

    const page = store.list({ limit: 2, offset: 1 });
    expect(page).toHaveLength(2);
    expect(page[0].tool).toBe('t1');
    expect(page[1].tool).toBe('t2');
  });

  it('verifies a valid chain', () => {
    const store = createStore();

    store.record({ tool: 'a', action: 'invoke', inputHash: '1', outputHash: '1', success: true, durationMs: 1 });
    store.record({ tool: 'b', action: 'invoke', inputHash: '2', outputHash: '2', success: true, durationMs: 2 });

    const result = store.verifyChain();
    expect(result.valid).toBe(true);
    expect(result.receiptsChecked).toBe(2);
  });

  it('verifies empty chain as valid', () => {
    const store = createStore();
    const result = store.verifyChain();
    expect(result.valid).toBe(true);
    expect(result.receiptsChecked).toBe(0);
  });

  it('returns summary statistics', () => {
    const store = createStore();

    store.record({ tool: 'a', action: 'invoke', inputHash: '1', outputHash: '1', success: true, durationMs: 1 });
    store.record({ tool: 'a', action: 'invoke', inputHash: '2', outputHash: '2', success: false, durationMs: 2 });
    store.record({ tool: 'b', action: 'invoke', inputHash: '3', outputHash: '3', success: true, durationMs: 3 });

    const summary = store.summary();
    expect(summary.total).toBe(3);
    expect(summary.byTool).toEqual({ a: 2, b: 1 });
    expect(summary.successRate).toBeCloseTo(2 / 3);
    expect(summary.chainValid).toBe(true);
    expect(summary.firstTimestamp).toBeTruthy();
    expect(summary.lastTimestamp).toBeTruthy();
  });

  it('returns clean summary for empty store', () => {
    const store = createStore();
    const summary = store.summary();
    expect(summary.total).toBe(0);
    expect(summary.byTool).toEqual({});
    expect(summary.successRate).toBe(1);
    expect(summary.chainValid).toBe(true);
  });

  it('recovers lastHash on reopen', () => {
    const dbPath = tempDbPath();
    const store1 = new ReceiptStore(dbPath);
    stores.push(store1);

    const r1 = store1.record({ tool: 'a', action: 'invoke', inputHash: '1', outputHash: '1', success: true, durationMs: 1 });
    store1.close();

    const store2 = new ReceiptStore(dbPath);
    stores.push(store2);

    const r2 = store2.record({ tool: 'b', action: 'invoke', inputHash: '2', outputHash: '2', success: true, durationMs: 2 });
    expect(r2.prevHash).toBe(r1.receiptHash);

    const result = store2.verifyChain();
    expect(result.valid).toBe(true);
    expect(result.receiptsChecked).toBe(2);
  });

  it('stores optional fields (policyRef, apiKeyPrefix)', () => {
    const store = createStore();
    const receipt = store.record({
      tool: 'a',
      action: 'invoke',
      inputHash: '1',
      outputHash: '1',
      success: true,
      policyRef: 'bind.demo.credit',
      apiKeyPrefix: 'idbr_abc...',
      durationMs: 5,
    });

    expect(receipt.policyRef).toBe('bind.demo.credit');
    expect(receipt.apiKeyPrefix).toBe('idbr_abc...');

    const listed = store.list();
    expect(listed[0].policyRef).toBe('bind.demo.credit');
    expect(listed[0].apiKeyPrefix).toBe('idbr_abc...');
  });
});
