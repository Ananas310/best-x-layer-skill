import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { normalize } from '../src/core/normalize.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const load = (name) => JSON.parse(readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));

// Pinned clock so recency / age signals are deterministic: 2026-04-11T12:00:00Z
const NOW = 1776254400000;

function byName(signals, name) {
  return signals.find(s => s.name === name);
}
function approx(actual, expected, eps = 1e-3) {
  assert.ok(
    Math.abs(actual - expected) < eps,
    `expected ${expected} ± ${eps}, got ${actual}`
  );
}

test('normalize high-rep fixture produces six well-formed signals', () => {
  const fx = load('high-rep.json');
  const { signals, derived } = normalize(fx, { now: NOW });

  const names = signals.map(s => s.name);
  assert.deepEqual(names, [
    'onChainSummary', 'feedbackVolume', 'uniqueClients',
    'recencyScore', 'registrationAge', 'metadataQuality',
  ]);

  // Every signal is in [0,1]
  for (const s of signals) {
    assert.ok(s.value >= 0 && s.value <= 1, `${s.name}=${s.value} out of range`);
    assert.ok(s.weight > 0 && s.weight <= 1, `${s.name} weight out of range`);
    assert.ok(s.source === 'indexer' || s.source === 'rpc');
    assert.ok(typeof s.note === 'string' && s.note.length > 0);
  }

  approx(byName(signals, 'onChainSummary').value, 0.92);
  approx(byName(signals, 'feedbackVolume').value, Math.log10(1 + 23) / Math.log10(101));
  approx(byName(signals, 'uniqueClients').value, 15 / 20);
  approx(byName(signals, 'registrationAge').value, 158 / 180);
  approx(byName(signals, 'metadataQuality').value, 1.0);
  // Last feedback is 3 days before NOW
  approx(byName(signals, 'recencyScore').value, Math.exp(-3 / 30));

  assert.equal(derived.count, 23);
  assert.equal(derived.uniqueClients, 15);
});

test('normalize low-rep fixture marks small but present signal set', () => {
  const fx = load('low-rep.json');
  const { signals, derived } = normalize(fx, { now: NOW });

  approx(byName(signals, 'onChainSummary').value, 0.30);
  approx(byName(signals, 'feedbackVolume').value, Math.log10(1 + 3) / Math.log10(101));
  approx(byName(signals, 'uniqueClients').value, 1 / 20);
  approx(byName(signals, 'registrationAge').value, 5 / 180);
  approx(byName(signals, 'metadataQuality').value, 0.5); // name only

  assert.equal(derived.count, 3);
  assert.equal(derived.uniqueClients, 1);
});

test('normalize unknown fixture returns empty signals gracefully', () => {
  const fx = load('unknown.json');
  const { signals, derived } = normalize(fx, { now: NOW });
  assert.equal(signals.length, 0);
  assert.equal(derived.count, 0);
  assert.equal(derived.uniqueClients, 0);
  assert.equal(derived.daysSinceLast, null);
});

test('normalize tolerates missing rpc.summary (uses event-only signals)', () => {
  const fx = load('high-rep.json');
  const withoutRpc = { ...fx, rpc: { ...fx.rpc, summary: null, card: null } };
  const { signals } = normalize(withoutRpc, { now: NOW });
  const names = signals.map(s => s.name);
  assert.ok(!names.includes('onChainSummary'));
  assert.ok(!names.includes('metadataQuality'));
  assert.ok(names.includes('feedbackVolume'));
  assert.ok(names.includes('uniqueClients'));
});

test('normalize handles null bundle without throwing', () => {
  const { signals, derived } = normalize(null, { now: NOW });
  assert.deepEqual(signals, []);
  assert.equal(derived.count, 0);
});
