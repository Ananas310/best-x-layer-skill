import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createPublicClient, http, decodeEventLog } from 'viem';
import { TOPICS, padTopicUint, padTopicAddress } from '../core/topics.js';
import { identityAbi, reputationAbi } from './abis.js';
import { signOkxRequest } from './okxSigner.js';
import { loadEnv } from '../util/env.js';
import { ErrorCode } from '../core/errors.js';
import { sanitizeErrorMessage } from '../util/security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '..', '..', 'tests', 'fixtures');

export const CONTRACTS = Object.freeze({
  identity: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
  reputation: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
  validation: null,
});

const X_LAYER = {
  id: 196,
  name: 'X Layer',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: { default: { http: ['https://xlayerrpc.okx.com'] } },
};

class OnchainOsError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'OnchainOsError';
    this.status = status;
    this.code = code;
  }
}

class TimeoutBudgetError extends Error {
  constructor(message, { code } = {}) {
    super(message);
    this.name = 'TimeoutBudgetError';
    this.code = code;
  }
}

function messageOf(err) {
  return String(err?.shortMessage ?? err?.message ?? err ?? '');
}

function toPublicError(err, fallbackCode, env) {
  return {
    code: err?.code ?? fallbackCode,
    message: sanitizeErrorMessage(messageOf(err), env),
  };
}

function sleep(ms, signal) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const abortErr = new Error('operation aborted');
      abortErr.name = 'AbortError';
      reject(abortErr);
      return;
    }
    const timer = setTimeout(() => {
      if (signal && onAbort) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      const abortErr = new Error('operation aborted');
      abortErr.name = 'AbortError';
      reject(abortErr);
    };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

function backoffMs(baseMs, attempt) {
  const exp = baseMs * (2 ** attempt);
  const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(baseMs / 2)));
  return exp + jitter;
}

function isAbortError(err) {
  return err?.name === 'AbortError' || /aborted/i.test(messageOf(err));
}

function shouldRetryIndexerError(err) {
  if (err?.code === ErrorCode.MISSING_CREDENTIALS) return false;
  if (err instanceof TimeoutBudgetError) return true;
  if (isAbortError(err)) return false;
  const status = Number(err?.status ?? 0);
  if (status === 408 || status === 425 || status === 429 || status >= 500) return true;
  return /(timeout|timed out|network|fetch failed|rate limit|too many requests|econn|eai_again|enotfound|socket hang up)/i.test(messageOf(err));
}

function shouldRetryRpcError(err) {
  const msg = messageOf(err);
  if (err instanceof TimeoutBudgetError) return true;
  if (isAbortError(err)) return false;
  if (/execution reverted|revert|invalid opcode|out of gas|insufficient funds/i.test(msg)) return false;
  return /(timeout|timed out|network|fetch failed|http request failed|rate limit|too many requests|429|5\d\d|econn|etimedout|enotfound|gateway)/i.test(msg);
}

async function withRetries(work, { retries, baseDelayMs, shouldRetry, onRetry, signal }) {
  const maxRetries = Math.max(0, Number(retries ?? 0));
  let attempt = 0;
  while (true) {
    try {
      return await work(attempt);
    } catch (err) {
      if (signal?.aborted) throw err;
      if (attempt >= maxRetries || !shouldRetry(err)) throw err;
      onRetry?.(attempt, err);
      await sleep(backoffMs(baseDelayMs, attempt), signal);
      attempt += 1;
    }
  }
}

function createTimedSignal(parentSignal, timeoutMs, errorCode, label) {
  const controller = new AbortController();
  let timeout;
  let onAbort;

  if (parentSignal?.aborted) {
    controller.abort(parentSignal.reason ?? new Error('operation aborted'));
  } else if (parentSignal) {
    onAbort = () => controller.abort(parentSignal.reason ?? new Error('operation aborted'));
    parentSignal.addEventListener('abort', onAbort, { once: true });
  }

  if (timeoutMs > 0) {
    timeout = setTimeout(() => {
      controller.abort(new TimeoutBudgetError(`${label} timed out after ${timeoutMs}ms`, { code: errorCode }));
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    cleanup() {
      if (timeout) clearTimeout(timeout);
      if (parentSignal && onAbort) parentSignal.removeEventListener('abort', onAbort);
    },
  };
}

async function withPromiseTimeout(work, { timeoutMs, errorCode, label, signal }) {
  if (signal?.aborted) {
    const abortErr = new Error('operation aborted');
    abortErr.name = 'AbortError';
    throw abortErr;
  }
  if (!timeoutMs || timeoutMs <= 0) return work();

  let timer;
  let onAbort;
  try {
    return await Promise.race([
      Promise.resolve().then(() => work()),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new TimeoutBudgetError(`${label} timed out after ${timeoutMs}ms`, { code: errorCode }));
        }, timeoutMs);
        if (signal) {
          onAbort = () => {
            const abortErr = new Error('operation aborted');
            abortErr.name = 'AbortError';
            reject(abortErr);
          };
          signal.addEventListener('abort', onAbort, { once: true });
        }
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    if (signal && onAbort) signal.removeEventListener('abort', onAbort);
  }
}

// ---------- Public client cache ----------
let _client = null;
function getViemClient(env = loadEnv()) {
  if (_client) return _client;
  _client = createPublicClient({
    chain: { ...X_LAYER, rpcUrls: { default: { http: [env.XLAYER_RPC_URL] } } },
    transport: http(env.XLAYER_RPC_URL),
  });
  return _client;
}
export function _resetClientCacheForTests() { _client = null; }

// ---------- OnChain OS (OKLink) Explorer API ----------
// Documented endpoint family, auth scheme: OKX v5 HMAC-SHA256 over
// timestamp+METHOD+requestPath+body.  Probed endpoints (return 401 on no key):
//   GET /api/v5/explorer/log/by-address-and-topic
//   GET /api/v5/explorer/log/by-address
//   GET /api/v5/explorer/address/transaction-list

async function okxGet(pathname, query, env, counters, signal) {
  if (!env.hasOnchainOsCreds) {
    throw new OnchainOsError('OnChain OS credentials missing', { code: ErrorCode.MISSING_CREDENTIALS });
  }
  return withRetries(async () => {
    const qs = new URLSearchParams(query).toString();
    const requestPath = qs ? `${pathname}?${qs}` : pathname;
    const url = `${env.ONCHAINOS_BASE_URL}${requestPath}`;
    const headers = signOkxRequest({
      method: 'GET',
      requestPath,
      body: '',
      secret: env.OKX_ONCHAINOS_SECRET_KEY,
      passphrase: env.OKX_ONCHAINOS_PASSPHRASE,
      apiKey: env.OKX_ONCHAINOS_API_KEY,
    });
    const timeout = createTimedSignal(signal, env.REPUTATION_REQUEST_TIMEOUT_MS, ErrorCode.INDEXER_UNAVAILABLE, 'OnChain OS request');
    try {
      counters.onchainOsCalls += 1;
      const res = await fetch(url, { method: 'GET', headers, signal: timeout.signal });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new OnchainOsError(`OnChain OS HTTP ${res.status}: ${body}`, {
          status: res.status,
          code: ErrorCode.INDEXER_UNAVAILABLE,
        });
      }
      const json = await res.json();
      if (json && json.code != null && String(json.code) !== '0') {
        throw new OnchainOsError(`OnChain OS API code ${json.code}: ${json.msg ?? ''}`, {
          code: ErrorCode.INDEXER_UNAVAILABLE,
        });
      }
      return Array.isArray(json?.data) ? json.data : [];
    } catch (err) {
      if (timeout.signal.aborted && timeout.signal.reason instanceof TimeoutBudgetError) {
        throw timeout.signal.reason;
      }
      throw err;
    } finally {
      timeout.cleanup();
    }
  }, {
    retries: env.REPUTATION_OKX_MAX_RETRIES,
    baseDelayMs: env.REPUTATION_RETRY_BASE_MS,
    shouldRetry: shouldRetryIndexerError,
    onRetry: () => { counters.onchainOsRetries = (counters.onchainOsRetries ?? 0) + 1; },
    signal,
  });
}

// OnChain OS returns logs with fields like { topics[], data, blockNumber, blockTime, logIndex, transactionHash }.
// Shape varies slightly by chain/version, so we normalize defensively.
function toRawLog(entry) {
  const topicsRaw = entry.topics ?? entry.topic ?? [];
  const topics = Array.isArray(topicsRaw) ? topicsRaw : String(topicsRaw).split(',');
  return {
    topics,
    data: entry.data ?? '0x',
    blockNumber: entry.blockNumber ?? entry.blockHeight ?? null,
    blockTimestamp: entry.blockTime
      ? Math.floor(Number(entry.blockTime) / 1000)
      : entry.blockTimestamp
        ? Number(entry.blockTimestamp)
        : null,
    transactionHash: entry.transactionHash ?? entry.txHash ?? null,
    logIndex: entry.logIndex ?? null,
  };
}

function decodeFeedbackLog(raw) {
  try {
    const decoded = decodeEventLog({
      abi: reputationAbi,
      topics: raw.topics,
      data: raw.data,
      eventName: 'NewFeedback',
    });
    const a = decoded.args;
    return {
      client: String(a.client ?? '').toLowerCase(),
      feedbackIndex: a.feedbackIndex != null ? Number(a.feedbackIndex) : null,
      score: a.score != null ? Number(a.score) : null,
      scoreDecimals: a.scoreDecimals != null ? Number(a.scoreDecimals) : 0,
      tag1Hash: raw.topics[3] ?? null,
      blockTimestamp: raw.blockTimestamp,
      transactionHash: raw.transactionHash,
    };
  } catch (_err) {
    return null;
  }
}

function decodeRegisteredLog(raw) {
  try {
    const decoded = decodeEventLog({
      abi: identityAbi,
      topics: raw.topics,
      data: raw.data,
      eventName: 'Registered',
    });
    return {
      owner: String(decoded.args.owner ?? '').toLowerCase(),
      agentURI: decoded.args.agentURI ?? '',
      blockTimestamp: raw.blockTimestamp,
      transactionHash: raw.transactionHash,
    };
  } catch (_err) {
    return null;
  }
}

// ---------- Mock fixture loader ----------
function loadFixture(tokenId) {
  const id = String(tokenId ?? '').trim();
  let file;
  if (id === '1') file = 'high-rep.json';
  else if (id === '9') file = 'low-rep.json';
  else file = 'unknown.json';
  return JSON.parse(readFileSync(path.join(FIXTURES_DIR, file), 'utf8'));
}
export function mockBundle(tokenId) {
  return loadFixture(tokenId);
}

function normalizeAddressList(addresses) {
  const out = [];
  const seen = new Set();
  const list = Array.isArray(addresses) ? addresses : [];
  for (const addr of list) {
    const value = String(addr ?? '').trim().toLowerCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function _selectSummaryClientAddresses(clientAddresses = [], rpcClients = []) {
  const explicit = normalizeAddressList(clientAddresses);
  if (explicit.length > 0) return explicit;
  return normalizeAddressList(rpcClients);
}

async function readContractWithGuards(client, request, { env, counters, signal, optional = false }) {
  const work = () => withPromiseTimeout(async () => {
    counters.rpcCalls += 1;
    return client.readContract(request);
  }, {
    timeoutMs: env.REPUTATION_REQUEST_TIMEOUT_MS,
    errorCode: ErrorCode.RPC_UNAVAILABLE,
    label: `RPC ${request.functionName}`,
    signal,
  });

  try {
    return await withRetries(work, {
      retries: env.REPUTATION_RPC_MAX_RETRIES,
      baseDelayMs: env.REPUTATION_RETRY_BASE_MS,
      shouldRetry: shouldRetryRpcError,
      onRetry: () => { counters.rpcRetries = (counters.rpcRetries ?? 0) + 1; },
      signal,
    });
  } catch (err) {
    if (optional) return null;
    throw err;
  }
}

// ---------- Main fetch ----------
export async function fetchReputationBundle({
  tokenId,
  clientAddresses = [],
  source = 'auto',
  env = loadEnv(),
  counters,
  signal,
}) {
  counters = counters ?? { onchainOsCalls: 0, rpcCalls: 0, onchainOsRetries: 0, rpcRetries: 0 };

  if (source === 'mock') {
    return loadFixture(tokenId);
  }

  const bundle = {
    tokenId: String(tokenId),
    events: { feedback: [], registered: [], uriUpdated: [] },
    rpc: { summary: null, clients: [], tokenURI: null, owner: null, agentWallet: null, card: null },
    path: 'none',
    indexerError: null,
    rpcError: null,
  };

  const wantIndexer = source === 'auto' || source === 'indexer';
  const wantRpc = source === 'auto' || source === 'rpc';

  // ---- Primary: OnChain OS event logs ----
  if (wantIndexer) {
    try {
      if (!env.hasOnchainOsCreds) {
        throw new OnchainOsError('OnChain OS credentials missing', { code: ErrorCode.MISSING_CREDENTIALS });
      }
      const topic1 = padTopicUint(tokenId);

      const rawFeedback = await okxGet('/api/v5/explorer/log/by-address-and-topic', {
        chainShortName: 'xlayer',
        address: CONTRACTS.reputation,
        topic0: TOPICS.reputation.newFeedback,
        topic1,
        limit: '100',
      }, env, counters, signal);
      bundle.events.feedback = rawFeedback.map(toRawLog).map(decodeFeedbackLog).filter(Boolean);

      const rawRegistered = await okxGet('/api/v5/explorer/log/by-address-and-topic', {
        chainShortName: 'xlayer',
        address: CONTRACTS.identity,
        topic0: TOPICS.identity.registered,
        topic1,
        limit: '5',
      }, env, counters, signal);
      bundle.events.registered = rawRegistered.map(toRawLog).map(decodeRegisteredLog).filter(Boolean);

      const rawUriUpdated = await okxGet('/api/v5/explorer/log/by-address-and-topic', {
        chainShortName: 'xlayer',
        address: CONTRACTS.identity,
        topic0: TOPICS.identity.uriUpdated,
        topic1,
        limit: '20',
      }, env, counters, signal);
      bundle.events.uriUpdated = rawUriUpdated.map(toRawLog);

      bundle.path = 'indexer';
    } catch (err) {
      if (source === 'indexer') throw err;
      bundle.indexerError = toPublicError(err, ErrorCode.INDEXER_UNAVAILABLE, env);
    }
  }

  // ---- Augmentation: viem RPC view calls ----
  if (wantRpc) {
    try {
      const client = getViemClient(env);
      const agentId = BigInt(tokenId);

      const clientsPromise = readContractWithGuards(client, {
        address: CONTRACTS.reputation, abi: reputationAbi, functionName: 'getClients',
        args: [agentId],
      }, { env, counters, signal });
      const tokenUriPromise = readContractWithGuards(client, {
        address: CONTRACTS.identity, abi: identityAbi, functionName: 'tokenURI',
        args: [agentId],
      }, { env, counters, signal, optional: true });
      const ownerPromise = readContractWithGuards(client, {
        address: CONTRACTS.identity, abi: identityAbi, functionName: 'ownerOf',
        args: [agentId],
      }, { env, counters, signal, optional: true });

      const clients = await clientsPromise;
      const normalizedClients = normalizeAddressList(clients);
      const summaryClientAddresses = _selectSummaryClientAddresses(clientAddresses, normalizedClients);
      const rawSummary = summaryClientAddresses.length > 0
        ? await readContractWithGuards(client, {
          address: CONTRACTS.reputation, abi: reputationAbi, functionName: 'getSummary',
          args: [agentId, summaryClientAddresses, '', ''],
        }, { env, counters, signal })
        : null;
      const [tokenURI, owner] = await Promise.all([tokenUriPromise, ownerPromise]);

      bundle.rpc.summary = rawSummary
        ? { count: String(rawSummary[0]), summaryValue: String(rawSummary[1]), decimals: Number(rawSummary[2]) }
        : null;
      bundle.rpc.clients = normalizedClients;
      bundle.rpc.tokenURI = tokenURI ? String(tokenURI) : null;
      bundle.rpc.owner = owner ? String(owner).toLowerCase() : null;

      if (bundle.rpc.tokenURI) {
        bundle.rpc.card = await fetchAgentCard(bundle.rpc.tokenURI, { signal, env, counters }).catch(() => null);
      }

      if (bundle.path === 'indexer') bundle.path = 'mixed';
      else if (bundle.path === 'none') bundle.path = 'rpc';
    } catch (err) {
      if (source === 'rpc') throw err;
      bundle.rpcError = toPublicError(err, ErrorCode.RPC_UNAVAILABLE, env);
    }
  }

  return bundle;
}

// Fetches the agent registration card JSON from an ipfs:// or http(s):// URI.
async function fetchAgentCard(uri, { signal, env, counters }) {
  if (!uri) return null;
  let url;
  if (uri.startsWith('ipfs://')) {
    const cid = uri.slice('ipfs://'.length);
    url = `https://ipfs.io/ipfs/${cid}`;
  } else if (/^https?:\/\//i.test(uri)) {
    url = uri;
  } else if (uri.startsWith('data:application/json')) {
    const comma = uri.indexOf(',');
    if (comma < 0) return null;
    const payload = uri.slice(comma + 1);
    try {
      const decoded = uri.includes('base64') ? Buffer.from(payload, 'base64').toString('utf8') : decodeURIComponent(payload);
      return JSON.parse(decoded);
    } catch { return null; }
  } else {
    return null;
  }
  return withRetries(async () => {
    const timeout = createTimedSignal(signal, env.REPUTATION_REQUEST_TIMEOUT_MS, ErrorCode.RPC_UNAVAILABLE, 'Agent card fetch');
    try {
      counters.rpcCalls += 1;
      const res = await fetch(url, { signal: timeout.signal });
      if (!res.ok) {
        const err = new Error(`agent card HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return res.json();
    } catch (err) {
      if (timeout.signal.aborted && timeout.signal.reason instanceof TimeoutBudgetError) {
        throw timeout.signal.reason;
      }
      throw err;
    } finally {
      timeout.cleanup();
    }
  }, {
    retries: env.REPUTATION_RPC_MAX_RETRIES,
    baseDelayMs: env.REPUTATION_RETRY_BASE_MS,
    shouldRetry: shouldRetryRpcError,
    onRetry: () => { counters.rpcRetries = (counters.rpcRetries ?? 0) + 1; },
    signal,
  }).catch(() => null);
}

// ---- Address → tokenId resolution via OnChain OS event scan ----
export async function resolveTokenIdFromAddress(address, { env = loadEnv(), counters, signal } = {}) {
  counters = counters ?? { onchainOsCalls: 0, rpcCalls: 0 };
  const topic2 = padTopicAddress(address);
  const rows = await okxGet('/api/v5/explorer/log/by-address-and-topic', {
    chainShortName: 'xlayer',
    address: CONTRACTS.identity,
    topic0: TOPICS.identity.registered,
    topic2,
    limit: '1',
  }, env, counters, signal);
  if (!rows || !rows.length) return null;
  const raw = toRawLog(rows[0]);
  // Registered's topic1 is the indexed agentId
  const topic1 = raw.topics[1];
  if (!topic1) return null;
  return BigInt(topic1).toString();
}
