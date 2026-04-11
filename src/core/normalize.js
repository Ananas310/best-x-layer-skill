// Pure. No network. Takes a decoded reputation bundle (as produced by
// adapters/8004Client.js) and returns a list of [0,1] signals + derived stats.

const DAY_MS = 86_400_000;

function round(n, digits = 6) {
  if (!Number.isFinite(n)) return n;
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function toNumber(value, fallback = 0) {
  if (value == null) return fallback;
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string' && value !== '') return Number(value);
  return fallback;
}

function cardQuality(card) {
  if (!card || typeof card !== 'object') return null;
  const hasName = typeof card.name === 'string' && card.name.length > 0;
  const hasServices = Array.isArray(card.services) && card.services.length > 0;
  const hasTrust = Array.isArray(card.supportedTrust) && card.supportedTrust.length > 0;
  const value = (hasName ? 0.5 : 0) + (hasServices ? 0.25 : 0) + (hasTrust ? 0.25 : 0);
  return { value, hasName, hasServices, hasTrust };
}

export function normalize(bundle, { now = Date.now() } = {}) {
  const signals = [];
  if (!bundle) {
    return { signals, derived: { count: 0, uniqueClients: 0, daysSinceLast: null, ageDays: null } };
  }

  const feedback = Array.isArray(bundle.events?.feedback) ? bundle.events.feedback : [];
  const registered = Array.isArray(bundle.events?.registered) ? bundle.events.registered : [];
  const rpc = bundle.rpc ?? {};

  // ---- 1. onChainSummary (rpc) ----
  if (rpc.summary && rpc.summary.count != null) {
    const summaryValue = toNumber(rpc.summary.summaryValue, 0);
    const decimals = toNumber(rpc.summary.decimals, 0);
    let value;
    if (decimals > 0) {
      value = summaryValue / 10 ** decimals;
    } else {
      value = summaryValue / 100;
    }
    value = Math.min(1, Math.max(0, value));
    signals.push({
      name: 'onChainSummary',
      value: round(value),
      weight: 0.30,
      source: 'rpc',
      note: `getSummary returned summaryValue=${summaryValue} decimals=${decimals}`,
    });
  }

  // ---- 2. feedbackVolume (indexer preferred, fallback rpc.summary.count) ----
  const indexerCount = feedback.length;
  const rpcCount = rpc.summary ? toNumber(rpc.summary.count, 0) : 0;
  const count = Math.max(indexerCount, rpcCount);
  if (count > 0) {
    const v = Math.log10(1 + count) / Math.log10(101);
    signals.push({
      name: 'feedbackVolume',
      value: round(Math.min(1, v)),
      weight: 0.20,
      source: indexerCount >= rpcCount ? 'indexer' : 'rpc',
      note: `${count} feedback events`,
    });
  }

  // ---- 3. uniqueClients (indexer or rpc.clients[]) ----
  const clientsFromEvents = new Set(feedback.map(f => String(f.client ?? '').toLowerCase()).filter(Boolean));
  const clientsFromRpc = new Set(
    (Array.isArray(rpc.clients) ? rpc.clients : []).map(c => String(c).toLowerCase())
  );
  const uniqueSet = clientsFromEvents.size >= clientsFromRpc.size ? clientsFromEvents : clientsFromRpc;
  const uniqueCount = uniqueSet.size;
  if (uniqueCount > 0) {
    const v = Math.min(1, uniqueCount / 20);
    signals.push({
      name: 'uniqueClients',
      value: round(v),
      weight: 0.15,
      source: clientsFromEvents.size >= clientsFromRpc.size ? 'indexer' : 'rpc',
      note: `${uniqueCount} unique clients (target ≥20)`,
    });
  }

  // ---- 4. recencyScore (indexer) ----
  let daysSinceLast = null;
  if (feedback.length > 0) {
    const lastTsMs = feedback.reduce((m, f) => {
      const t = toNumber(f.blockTimestamp, 0) * 1000;
      return t > m ? t : m;
    }, 0);
    if (lastTsMs > 0) {
      daysSinceLast = Math.max(0, (now - lastTsMs) / DAY_MS);
      const v = Math.exp(-daysSinceLast / 30);
      signals.push({
        name: 'recencyScore',
        value: round(Math.min(1, Math.max(0, v))),
        weight: 0.15,
        source: 'indexer',
        note: `${daysSinceLast.toFixed(1)}d since last feedback`,
      });
    }
  }

  // ---- 5. registrationAge (indexer) ----
  let ageDays = null;
  if (registered.length > 0) {
    const regTs = toNumber(registered[0].blockTimestamp, 0) * 1000;
    if (regTs > 0) {
      ageDays = Math.max(0, (now - regTs) / DAY_MS);
      const v = Math.min(1, ageDays / 180);
      signals.push({
        name: 'registrationAge',
        value: round(v),
        weight: 0.10,
        source: 'indexer',
        note: `${ageDays.toFixed(0)}d since registration`,
      });
    }
  }

  // ---- 6. metadataQuality (rpc card) ----
  const cq = cardQuality(rpc.card);
  if (cq) {
    signals.push({
      name: 'metadataQuality',
      value: round(cq.value),
      weight: 0.10,
      source: 'rpc',
      note: `name=${cq.hasName} services=${cq.hasServices} supportedTrust=${cq.hasTrust}`,
    });
  }

  return {
    signals,
    derived: {
      count,
      uniqueClients: uniqueCount,
      daysSinceLast: daysSinceLast == null ? null : round(daysSinceLast, 3),
      ageDays: ageDays == null ? null : round(ageDays, 3),
    },
  };
}
