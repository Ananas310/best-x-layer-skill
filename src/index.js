// Public entrypoint for the 8004 reputation skill.
//
//   import { getReputation } from '8004-reputation-skill';
//   const report = await getReputation('1', { source: 'mock' });
//
// Never throws across this boundary: all failures are returned as
// { ok: false, error: { code, message, hint } }.

import { fetchReputationBundle } from './adapters/8004Client.js';
import { resolveAgentId } from './core/resolve.js';
import { normalize } from './core/normalize.js';
import { score } from './core/score.js';
import { buildReport, buildError } from './core/schema.js';
import { ErrorCode } from './core/errors.js';
import { loadEnv } from './util/env.js';
import { sanitizeErrorMessage } from './util/security.js';

const DEFAULT_TTL = 300;

function emitAlerts(alerts, { onAlert, stderrEnabled }) {
  if (!Array.isArray(alerts) || alerts.length === 0) return;
  for (const alert of alerts) {
    if (typeof onAlert === 'function') {
      try { onAlert(alert); } catch {}
    }
    if (stderrEnabled) {
      process.stderr.write(`[rep8004][${alert.level}] ${alert.source}:${alert.code} ${alert.message}\n`);
    }
  }
}

export async function getReputation(agentInput, {
  source = 'auto',
  ttlSeconds = DEFAULT_TTL,
  includeRaw = false,
  clientAddresses = [],
  onAlert,
  env,
  now,
  signal,
} = {}) {
  const nowValue = now ?? Date.now();
  const envValue = env ?? loadEnv();
  const counters = { onchainOsCalls: 0, rpcCalls: 0, onchainOsRetries: 0, rpcRetries: 0 };

  let resolved;
  try {
    resolved = await resolveAgentId(agentInput, { source, env: envValue, counters, signal });
  } catch (err) {
    const out = buildError({
      agentId: agentInput,
      code: err.code ?? ErrorCode.INVALID_INPUT,
      message: sanitizeErrorMessage(err.message, envValue),
      hint: err.hint,
      now: nowValue,
    });
    emitAlerts(out.meta?.alerts, { onAlert, stderrEnabled: envValue.REPUTATION_ALERT_STDERR });
    return out;
  }

  let bundle;
  try {
    bundle = await fetchReputationBundle({
      tokenId: resolved.tokenId,
      clientAddresses,
      source,
      env: envValue,
      counters,
      signal,
    });
  } catch (err) {
    const out = buildError({
      agentId: resolved.tokenId,
      code: err.code ?? ErrorCode.UNKNOWN,
      message: sanitizeErrorMessage(err.message, envValue),
      hint: 'check XLAYER_RPC_URL and OnChain OS credentials in .env',
      now: nowValue,
    });
    emitAlerts(out.meta?.alerts, { onAlert, stderrEnabled: envValue.REPUTATION_ALERT_STDERR });
    return out;
  }

  let scoring;
  let signals;
  try {
    const n = normalize(bundle, { now: nowValue });
    signals = n.signals;
    scoring = score(signals);
  } catch (err) {
    const out = buildError({
      agentId: resolved.tokenId,
      code: ErrorCode.DECODE_FAILED,
      message: sanitizeErrorMessage(`normalization failed: ${err.message}`, envValue),
      now: nowValue,
    });
    emitAlerts(out.meta?.alerts, { onAlert, stderrEnabled: envValue.REPUTATION_ALERT_STDERR });
    return out;
  }

  const out = buildReport({
    agentId: resolved.tokenId,
    resolvedAs: resolved,
    scoring,
    signals,
    bundle,
    counters,
    ttlSeconds,
    includeRaw,
    now: nowValue,
  });
  emitAlerts(out.meta?.alerts, { onAlert, stderrEnabled: envValue.REPUTATION_ALERT_STDERR });
  return out;
}

export { CONTRACTS, fetchReputationBundle } from './adapters/8004Client.js';
export { normalize } from './core/normalize.js';
export { score } from './core/score.js';
export { evaluateTrustPolicy, TRUST_POLICY_PRESETS } from './core/policy.js';
export { resolveAgentId, classifyInput } from './core/resolve.js';
export { ErrorCode } from './core/errors.js';
export { SCHEMA_VERSION, CHAIN } from './core/schema.js';
