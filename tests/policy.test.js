import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateTrustPolicy } from '../src/core/policy.js';

function mkReport({ score = 80, confidence = 0.7, rating = 'high' } = {}) {
  return { ok: true, score, confidence, rating };
}

test('balanced/high risk allows strong high-rated report', () => {
  const out = evaluateTrustPolicy(mkReport({ score: 82, confidence: 0.6, rating: 'high' }), {
    preset: 'balanced',
    risk: 'high',
  });
  assert.equal(out.allow, true);
  assert.equal(out.decision.action, 'allow');
});

test('balanced/high risk blocks medium rating even with score/confidence', () => {
  const out = evaluateTrustPolicy(mkReport({ score: 90, confidence: 0.9, rating: 'medium' }), {
    preset: 'balanced',
    risk: 'high',
  });
  assert.equal(out.allow, false);
  assert.equal(out.decision.action, 'block');
});

test('unknown rating not meeting thresholds returns sandbox', () => {
  const out = evaluateTrustPolicy(mkReport({ score: 20, confidence: 0.1, rating: 'unknown' }), {
    preset: 'balanced',
    risk: 'medium',
  });
  assert.equal(out.allow, false);
  assert.equal(out.decision.action, 'sandbox');
  assert.equal(out.decision.needsReview, true);
});

test('invalid report envelope is blocked for safety', () => {
  const out = evaluateTrustPolicy({ ok: false }, { preset: 'growth', risk: 'low' });
  assert.equal(out.allow, false);
  assert.equal(out.reason, 'invalid_report');
});

test('strict is harder than growth on same report', () => {
  const report = mkReport({ score: 60, confidence: 0.4, rating: 'medium' });
  const strictOut = evaluateTrustPolicy(report, { preset: 'strict', risk: 'medium' });
  const growthOut = evaluateTrustPolicy(report, { preset: 'growth', risk: 'medium' });
  assert.equal(strictOut.allow, false);
  assert.equal(growthOut.allow, true);
});
