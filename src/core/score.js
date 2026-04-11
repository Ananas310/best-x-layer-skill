// Pure. Deterministic weighted-sum score with coverage-aware confidence.

function round(n, digits = 3) {
  if (!Number.isFinite(n)) return 0;
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function byName(signals, name) {
  return signals.find(s => s.name === name);
}

export function score(signals) {
  if (!Array.isArray(signals) || signals.length === 0) {
    return { score: 0, confidence: 0, rating: 'unknown' };
  }

  const weightSum = signals.reduce((s, x) => s + x.weight, 0);
  if (weightSum <= 0) {
    return { score: 0, confidence: 0, rating: 'unknown' };
  }

  const weighted = signals.reduce((s, x) => s + x.value * x.weight, 0);
  const normalized = weighted / weightSum; // [0,1]
  const score100 = Math.round(normalized * 100);

  // Confidence components:
  //  - coverage: how much of the full 1.0 weight budget is present
  //  - volumeBoost: reputation data volume (via feedbackVolume signal if present)
  //  - agreement: how closely the RPC summary agrees with the indexer feedback volume
  const coverage = Math.min(1, weightSum); // full coverage = 1.0
  const volumeSignal = byName(signals, 'feedbackVolume');
  const volumeBoost = volumeSignal ? Math.min(1, volumeSignal.value * 1.5) : 0;

  const rpcSummary = byName(signals, 'onChainSummary');
  const agreement = rpcSummary && volumeSignal
    ? 1 - Math.min(1, Math.abs(rpcSummary.value - volumeSignal.value))
    : 0.5;

  const confidenceRaw = 0.4 * coverage + 0.4 * volumeBoost + 0.2 * agreement;
  const confidence = round(Math.min(1, Math.max(0, confidenceRaw)), 3);

  let rating;
  if (confidence < 0.25) rating = 'unknown';
  else if (score100 >= 75) rating = 'high';
  else if (score100 >= 45) rating = 'medium';
  else rating = 'low';

  return { score: score100, confidence, rating };
}
