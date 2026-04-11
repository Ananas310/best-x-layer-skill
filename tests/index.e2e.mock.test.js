import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getReputation, SCHEMA_VERSION } from '../src/index.js';

const NOW = 1776254400000; // 2026-04-11T12:00:00Z

test('getReputation high-rep fixture: full report with rating=high', async () => {
  const r = await getReputation('1', { source: 'mock', now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.schemaVersion, SCHEMA_VERSION);
  assert.equal(r.agentId, '1');
  assert.equal(r.rating, 'high');
  assert.ok(r.score >= 75, `expected score>=75, got ${r.score}`);
  assert.ok(r.confidence > 0.7);
  assert.equal(r.signals.length, 6);
  assert.equal(r.meta.source, 'mock');
  assert.equal(r.meta.onchainOsRetries, 0);
  assert.equal(r.meta.rpcRetries, 0);
  assert.ok(Array.isArray(r.meta.alerts));
  assert.equal(r.meta.alerts.length, 0);
  assert.equal(r.meta.chain.id, 196);
  assert.equal(r.meta.contracts.identity, '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432');
  assert.equal(r.ttlSeconds, 300);
});

test('getReputation low-rep fixture: rating=low, confidence below high', async () => {
  const r = await getReputation('9', { source: 'mock', now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.agentId, '9');
  assert.ok(['low', 'medium'].includes(r.rating));
  assert.ok(r.score < 75);
});

test('getReputation unknown fixture: rating=unknown, empty signals', async () => {
  const r = await getReputation('999', { source: 'mock', now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.agentId, '999');
  assert.equal(r.signals.length, 0);
  assert.equal(r.rating, 'unknown');
  assert.equal(r.score, 0);
});

test('getReputation returns error envelope for invalid input, never throws', async () => {
  const r = await getReputation('', { source: 'mock', now: NOW });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'INVALID_INPUT');
  assert.ok(typeof r.error.message === 'string' && r.error.message.length > 0);
  assert.equal(r.schemaVersion, SCHEMA_VERSION);
  assert.ok(Array.isArray(r.meta.alerts));
  assert.equal(r.meta.alerts[0]?.code, 'INVALID_INPUT');
});

test('getReputation includeRaw=true attaches the raw bundle', async () => {
  const r = await getReputation('1', { source: 'mock', now: NOW, includeRaw: true });
  assert.ok(r.raw, 'raw should be present');
  assert.ok(Array.isArray(r.raw.events.feedback));
  assert.equal(r.raw.events.feedback.length, 23);
});

test('getReputation report is JSON-serializable (no BigInt leaks)', async () => {
  const r = await getReputation('1', { source: 'mock', now: NOW, includeRaw: true });
  const s = JSON.stringify(r);
  assert.ok(s.length > 100);
  const round = JSON.parse(s);
  assert.equal(round.agentId, '1');
});

test('getReputation resolves address input in mock mode to high-rep fixture', async () => {
  const r = await getReputation('0xabcdef0123456789abcdef0123456789abcdef01', { source: 'mock', now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.agentId, '1');
  assert.equal(r.resolvedAs.kind, 'address');
});
