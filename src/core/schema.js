export const SCHEMA_VERSION = '1.0.0';

export const CHAIN = Object.freeze({
  name: 'xlayer',
  id: 196,
  rpc: 'https://xlayerrpc.okx.com',
  rpcFallback: 'https://rpc.xlayer.tech',
  explorer: 'https://www.oklink.com/xlayer',
});

export const CONTRACTS = Object.freeze({
  identity: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
  reputation: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
  validation: null,
});

function jsonSafe(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = jsonSafe(v);
    return out;
  }
  return value;
}

function buildMetaAlerts({ source, indexerError, rpcError }) {
  const alerts = [];
  if (indexerError) {
    alerts.push({
      level: 'warning',
      source: 'indexer',
      code: indexerError.code ?? 'INDEXER_UNAVAILABLE',
      message: indexerError.message ?? 'indexer path failed',
    });
  }
  if (rpcError) {
    alerts.push({
      level: 'warning',
      source: 'rpc',
      code: rpcError.code ?? 'RPC_UNAVAILABLE',
      message: rpcError.message ?? 'rpc path failed',
    });
  }
  if (source === 'none') {
    alerts.push({
      level: 'error',
      source: 'pipeline',
      code: 'NO_DATA_SOURCE',
      message: 'both indexer and rpc paths failed',
    });
  }
  return alerts;
}

export function buildReport({ agentId, resolvedAs, scoring, signals, bundle, counters, ttlSeconds, includeRaw, now }) {
  const fetchedAt = new Date(now ?? Date.now()).toISOString();
  const source = bundle?.path ?? 'unknown';
  const indexerError = bundle?.indexerError ?? null;
  const rpcError = bundle?.rpcError ?? null;
  const report = {
    ok: true,
    schemaVersion: SCHEMA_VERSION,
    agentId: String(agentId),
    resolvedAs: resolvedAs ? jsonSafe(resolvedAs) : null,
    score: scoring.score,
    confidence: scoring.confidence,
    rating: scoring.rating,
    signals: jsonSafe(signals),
    fetchedAt,
    ttlSeconds,
    meta: {
      source,
      onchainOsCalls: counters?.onchainOsCalls ?? 0,
      rpcCalls: counters?.rpcCalls ?? 0,
      onchainOsRetries: counters?.onchainOsRetries ?? 0,
      rpcRetries: counters?.rpcRetries ?? 0,
      chain: CHAIN,
      contracts: CONTRACTS,
      indexerError,
      rpcError,
      alerts: buildMetaAlerts({ source, indexerError, rpcError }),
    },
  };
  if (includeRaw) {
    report.raw = jsonSafe({
      events: bundle?.events ?? null,
      rpc: bundle?.rpc ?? null,
    });
  }
  return report;
}

export function buildError({ agentId, code, message, hint, now }) {
  return {
    ok: false,
    schemaVersion: SCHEMA_VERSION,
    agentId: agentId == null ? null : String(agentId),
    error: { code, message, hint: hint ?? null },
    fetchedAt: new Date(now ?? Date.now()).toISOString(),
    meta: {
      chain: CHAIN,
      contracts: CONTRACTS,
      alerts: [{ level: 'error', source: 'pipeline', code, message }],
    },
  };
}
