# 8004 Agent Reputation Skill

A reusable, read-only agent capability that queries **ERC-8004** trust
registries on **X Layer** and returns a normalized reputation report —
built for the OKX Build X AI Hackathon (Skill Arena track), with
**OnChain OS** as the primary data source.

- **Input:** target agent — numeric tokenId, `0x` owner address, or handle
- **Output:** `{ score (0–100), confidence (0–1), rating (high|medium|low|unknown), signals[], meta }`
- **Data path:** OnChain OS Explorer API (historical events) + viem RPC (live `getSummary`, `tokenURI`, `ownerOf`)
- **Never throws** across the public boundary — failures return an error envelope

---

## Quick start

```bash
npm install           # three deps: viem, dotenv + node:test
npm test              # 38 unit tests, no network, <500ms

# Offline demos — deterministic, no credentials required
node src/cli.js --agent 1   --mock --pretty     # high-rep: score 86, rating high
node src/cli.js --agent 9   --mock --pretty     # low-rep:  score 36, rating low
node src/cli.js --agent 999 --mock --pretty     # unknown:  rating unknown, signals=[]
```

Full captured runs live in [docs/demo.md](docs/demo.md).

### Running against live X Layer

```bash
cp .env.example .env
# fill in OKX_ONCHAINOS_API_KEY / SECRET_KEY / PASSPHRASE

node src/cli.js --agent 1 --pretty
# expect: meta.onchainOsCalls >= 3, meta.rpcCalls >= 1, meta.source = "mixed"

# Optional: force RPC-only path
node src/cli.js --agent 1 --source rpc --pretty
```

The skill surfaces `meta.onchainOsCalls` and `meta.rpcCalls` in every report
so integrators (and judges) can see OnChain OS being used as the primary source.

---

## Integration snippet

```js
import { getReputation } from '8004-reputation-skill';

const report = await getReputation('1', {
  source: 'auto',               // 'auto' | 'indexer' | 'rpc' | 'mock'
  ttlSeconds: 300,
  includeRaw: false,
  clientAddresses: [],          // filter getSummary() to trusted reviewers
  onAlert: (a) => console.warn(a.code, a.message), // optional runtime hook
});

if (!report.ok) {
  console.error(report.error.code, report.error.message);
} else if (report.rating === 'high') {
  // delegate task to this agent
} else if (report.rating === 'unknown') {
  // new agent — require extra caution
}
```

The public API is in [src/index.js](src/index.js). Any agent framework that
can `import` an ESM function or shell out to `node src/cli.js` can use this
skill. The output is stable JSON shaped by [`src/core/schema.js`](src/core/schema.js)
(`schemaVersion: "1.0.0"`).

---

## How it scores

Six signals, each in `[0,1]`, weighted sum normalized by present-weight so
missing signals drop **confidence** rather than score:

| # | Signal | Formula | Source | Weight |
|---|---|---|---|---|
| 1 | `onChainSummary`  | `summaryValue / 10^decimals` (clipped) | rpc                 | 0.30 |
| 2 | `feedbackVolume`  | `log10(1 + count) / log10(101)`        | indexer (or rpc)    | 0.20 |
| 3 | `uniqueClients`   | `min(1, uniqueCount / 20)`             | indexer             | 0.15 |
| 4 | `recencyScore`    | `exp(-daysSinceLast / 30)`             | indexer             | 0.15 |
| 5 | `registrationAge` | `min(1, ageDays / 180)`                | indexer             | 0.10 |
| 6 | `metadataQuality` | `0.5·name + 0.25·services + 0.25·trust`| rpc (agent card)    | 0.10 |

```text
score      = round( Σ(value·weight) / Σ(weight) × 100 )
coverage   = min(1, Σ(weight))
agreement  = 1 − |onChainSummary − feedbackVolume|      (0.5 if either missing)
confidence = 0.4·coverage + 0.4·volumeBoost + 0.2·agreement

rating     = unknown  if confidence < 0.25
           | high     if score ≥ 75
           | medium   if score ≥ 45
           | low      otherwise
```

**Why normalize by `weightSum` instead of 1.0?** Missing signals shouldn't tank
the *score* — they should lower *confidence*. A brand-new agent with zero
feedback surfaces as `unknown`, not unfairly as `low`.

---

## ERC-8004 on X Layer

Same CREATE2 addresses as every other EVM deployment:

- Identity Registry:   `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- Reputation Registry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
- Validation Registry: *TBD* (skill treats as nullable)
- Chain ID:            **196** (X Layer)
- RPC:                 `https://xlayerrpc.okx.com`

Events consumed (topic0 hashes pinned in [src/core/topics.js](src/core/topics.js),
verified by a unit test that re-derives them via viem `keccak256`):

- `Reputation.NewFeedback(uint256 indexed agentId, address indexed client, uint64, int128, uint8, string, string, string, string, string, bytes32)`
- `Identity.Registered(uint256 indexed agentId, string agentURI, address indexed owner)`
- `Identity.URIUpdated(uint256 indexed agentId, string newURI, address indexed owner)`

RPC view calls: `Reputation.getSummary(agentId, clients, "", "")`,
`Reputation.getClients(agentId)`, `Identity.tokenURI(agentId)`,
`Identity.ownerOf(agentId)`.

---

## Architecture

```
src/
  index.js                 Public getReputation() — never throws
  cli.js                   --agent / --source / --mock / --pretty / --raw
  adapters/
    8004Client.js          Two-path fetch (OnChain OS primary, viem augment, mock)
    okxSigner.js           OKX v5 HMAC-SHA256 header builder
    abis.js                Minimal ABI fragments (viem-compatible)
  core/
    resolve.js             tokenId / 0x address / handle → canonical tokenId
    normalize.js           bundle → 6 signals (pure)
    score.js               signals → {score, confidence, rating} (pure)
    topics.js              Pinned topic0 hashes + dev re-derivation check
    schema.js              SCHEMA_VERSION, buildReport(), buildError()
    errors.js              ErrorCode enum
  util/
    env.js                 dotenv wrapper, hasOnchainOsCreds flag
tests/
  fixtures/                Deterministic high-rep / low-rep / unknown bundles
  okxSigner.test.js        HMAC known-vector
  adapter.decode.test.js   viem decode / topic hash re-derivation
  normalize.test.js        Fixtures → expected signals
  score.test.js            Rating thresholds, missing-signal handling
  resolve.test.js          Input classifier + resolver
  index.e2e.mock.test.js   Full pipeline via source:'mock'
docs/demo.md               Three captured sample runs
```

### Source path fall-through

- **`source: 'auto'`** (default) — OnChain OS first for events, viem RPC for
  `getSummary` / metadata. If OnChain OS fails, degrades silently to
  RPC-only and surfaces `meta.indexerError`.
- **`source: 'indexer'`** — OnChain OS only; fails loud on errors.
- **`source: 'rpc'`** — viem RPC only (no event history, so `uniqueClients`
  and `recencyScore` may be missing — reflected in lower confidence). If
  `--clients` is omitted, the skill auto-fills `getSummary()` inputs from
  on-chain `getClients(agentId)` to avoid empty-client reverts.
- **`source: 'mock'`** — reads from `tests/fixtures/*.json`; no network,
  ignores credentials. Used by the three `demo:*` npm scripts.

All network operations use timeout budgets + retries controlled by env:
`REPUTATION_REQUEST_TIMEOUT_MS`, `REPUTATION_OKX_MAX_RETRIES`,
`REPUTATION_RPC_MAX_RETRIES`, `REPUTATION_RETRY_BASE_MS`.

### Why OnChain OS is primary

X Layer's public RPC caps `eth_getLogs` at 100 blocks per call, which makes
viem-only historical event scans infeasible past a few minutes of history.
OnChain OS's `/api/v5/explorer/log/by-address-and-topic` endpoint is the
canonical historical indexer for X Layer and is exactly what this skill
needs: topic-filtered event logs with no range cap. That's why every
non-mock run makes at least 3 OnChain OS calls (feedback, registered,
URI-updated) before falling through to RPC for the live aggregate.

---

## Output schema (success)

```ts
{
  ok: true,
  schemaVersion: "1.0.0",
  agentId: string,
  resolvedAs: { tokenId, kind: 'id'|'address'|'handle', hint: string|null },
  score: number,           // 0–100 integer
  confidence: number,      // 0–1, 3 decimal places
  rating: 'high'|'medium'|'low'|'unknown',
  signals: Array<{ name, value, weight, source: 'rpc'|'indexer', note }>,
  fetchedAt: string,       // ISO 8601
  ttlSeconds: number,
  meta: {
    source: 'mock'|'indexer'|'rpc'|'mixed'|'none',
    onchainOsCalls: number,
    rpcCalls: number,
    onchainOsRetries: number,
    rpcRetries: number,
    chain: { name: 'xlayer', id: 196, rpc, ... },
    contracts: { identity, reputation, validation },
    indexerError: { code, message } | null,
    rpcError:     { code, message } | null,
    alerts: Array<{ level: 'warning'|'error', source, code, message }>,
  },
  raw?: { events, rpc }    // only when includeRaw=true
}
```

## Output schema (error)

```ts
{
  ok: false,
  schemaVersion: "1.0.0",
  agentId: string | null,
  error: { code: ErrorCode, message: string, hint: string | null },
  fetchedAt: string,
  meta: { chain, contracts, alerts },
}
```

`ErrorCode` values: `INVALID_INPUT`, `AGENT_NOT_FOUND`,
`INDEXER_UNAVAILABLE`, `RPC_UNAVAILABLE`, `DECODE_FAILED`,
`MISSING_CREDENTIALS`, `UNKNOWN`.

---

## Environment

Copy `.env.example` to `.env` and fill in:

```bash
OKX_ONCHAINOS_API_KEY=...
OKX_ONCHAINOS_SECRET_KEY=...
OKX_ONCHAINOS_PASSPHRASE=...
XLAYER_RPC_URL=https://xlayerrpc.okx.com   # optional override
ONCHAINOS_BASE_URL=https://www.oklink.com  # optional override
REPUTATION_REQUEST_TIMEOUT_MS=12000         # request timeout budget
REPUTATION_OKX_MAX_RETRIES=2                # indexer retry count
REPUTATION_RPC_MAX_RETRIES=2                # rpc retry count
REPUTATION_RETRY_BASE_MS=250                # exponential backoff base
REPUTATION_ALERT_STDERR=false               # emit alerts to stderr
```

If credentials are missing, the skill still runs in `rpc` or `mock` mode;
`auto` mode will surface `indexerError.code = MISSING_CREDENTIALS` in `meta`
and degrade to RPC-only.

Secret handling policy:
- inject secrets only via environment (`.env` locally, Actions Secrets in CI)
- rotate by updating provider keys first, then replacing CI/local env values
- the skill redacts known credential values from surfaced error messages
- never commit `.env` (already ignored by `.gitignore`)

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`
- `test-and-smoke` runs on push/PR with Node `20.x`: `npm test` + `npm run smoke`
- optional protected `live-smoke` runs only on manual dispatch with
  `run_live_smoke=true` and uses repository/environment secrets

## Scripts

```bash
npm test            # node --test tests/      (38 tests, <500ms)
npm run test:bun    # bun test tests/          (same suite via bun)
npm run smoke       # offline CLI smoke checks (mock fixtures)
npm run smoke:live  # includes live RPC/auto checks
npm run smoke:live:strict  # expects live commands to succeed (CI protected job)
npm run demo:high   # node src/cli.js --agent 1   --mock --pretty
npm run demo:low    # node src/cli.js --agent 9   --mock --pretty
npm run demo:unknown# node src/cli.js --agent 999 --mock --pretty
```
