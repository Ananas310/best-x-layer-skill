import { test } from 'node:test';
import assert from 'node:assert/strict';
import { score } from '../src/core/score.js';

const sig = (name, value, weight, source = 'rpc') => ({ name, value, weight, source, note: '' });

test('empty signals return unknown with zero score/confidence', () => {
  assert.deepEqual(score([]), { score: 0, confidence: 0, rating: 'unknown' });
});

test('perfect full-coverage signals yield rating=high, score=100', () => {
  const signals = [
    sig('onChainSummary', 1.0, 0.30),
    sig('feedbackVolume', 1.0, 0.20, 'indexer'),
    sig('uniqueClients', 1.0, 0.15, 'indexer'),
    sig('recencyScore', 1.0, 0.15, 'indexer'),
    sig('registrationAge', 1.0, 0.10, 'indexer'),
    sig('metadataQuality', 1.0, 0.10),
  ];
  const r = score(signals);
  assert.equal(r.score, 100);
  assert.equal(r.rating, 'high');
  assert.ok(r.confidence > 0.9);
});

test('all-zero full-coverage signals yield rating=low, score=0 (but confidence computed from coverage)', () => {
  const signals = [
    sig('onChainSummary', 0, 0.30),
    sig('feedbackVolume', 0, 0.20, 'indexer'),
    sig('uniqueClients', 0, 0.15, 'indexer'),
    sig('recencyScore', 0, 0.15, 'indexer'),
    sig('registrationAge', 0, 0.10, 'indexer'),
    sig('metadataQuality', 0, 0.10),
  ];
  const r = score(signals);
  assert.equal(r.score, 0);
  // volumeBoost=0, coverage=1, agreement=1 → 0.4 + 0 + 0.2 = 0.6
  assert.ok(Math.abs(r.confidence - 0.6) < 0.001);
  // Low confidence threshold is 0.25, and 0.6 > 0.25, so rating should be low (not unknown)
  assert.equal(r.rating, 'low');
});

test('rating thresholds: 75→high, 74→medium, 45→medium, 44→low', () => {
  const mk = (v) => ([
    sig('onChainSummary', v, 0.30),
    sig('feedbackVolume', v, 0.20, 'indexer'),
    sig('uniqueClients', v, 0.15, 'indexer'),
    sig('recencyScore', v, 0.15, 'indexer'),
    sig('registrationAge', v, 0.10, 'indexer'),
    sig('metadataQuality', v, 0.10),
  ]);
  assert.equal(score(mk(0.75)).rating, 'high');
  assert.equal(score(mk(0.74)).rating, 'medium');
  assert.equal(score(mk(0.45)).rating, 'medium');
  assert.equal(score(mk(0.44)).rating, 'low');
});

test('sparse signals (very low coverage) mark rating as unknown', () => {
  // Only metadata quality at 1.0, so score=100 but coverage=0.10 → low confidence
  const r = score([sig('metadataQuality', 1.0, 0.10)]);
  assert.equal(r.score, 100);
  // coverage=0.10, volumeBoost=0, agreement=0.5 → 0.04 + 0 + 0.1 = 0.14 < 0.25
  assert.ok(r.confidence < 0.25);
  assert.equal(r.rating, 'unknown');
});

test('missing onChainSummary still produces a score using remaining signals', () => {
  const signals = [
    sig('feedbackVolume', 0.8, 0.20, 'indexer'),
    sig('uniqueClients', 0.8, 0.15, 'indexer'),
    sig('recencyScore', 0.8, 0.15, 'indexer'),
    sig('registrationAge', 0.8, 0.10, 'indexer'),
    sig('metadataQuality', 0.8, 0.10),
  ];
  const r = score(signals);
  // weightSum = 0.70, weighted = 0.56, normalized = 0.8, score = 80
  assert.equal(r.score, 80);
  assert.equal(r.rating, 'high');
});

test('disagreement between rpc and indexer lowers confidence agreement term', () => {
  const agreed = [
    sig('onChainSummary', 0.5, 0.30),
    sig('feedbackVolume', 0.5, 0.20, 'indexer'),
  ];
  const disagreed = [
    sig('onChainSummary', 0.9, 0.30),
    sig('feedbackVolume', 0.1, 0.20, 'indexer'),
  ];
  assert.ok(score(agreed).confidence > score(disagreed).confidence);
});
