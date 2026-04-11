# Demo Runs

Three captured sample runs showing the full report shape for the three rating
tiers the scoring engine produces. All three use `--mock` so they're fully
offline, deterministic, and reproducible without credentials.

```bash
node src/cli.js --agent 1   --mock --pretty   # high-rep agent
node src/cli.js --agent 9   --mock --pretty   # low-rep agent
node src/cli.js --agent 999 --mock --pretty   # unknown agent
```

The pinned "now" in the fixture math is the ambient clock — reputation signals
like `recencyScore` and `registrationAge` are time-aware, so the reported age
numbers will drift with wall clock. Signal *values* stay stable because the
fixtures use recent timestamps clamped by `min()/exp()`.

---

## 1. High-rep agent (`--agent 1`)

**Verdict:** `score=86`, `confidence=0.954`, `rating=high`.

Six signals present, every weight covered (coverage=1.0), `onChainSummary`
agrees closely with the indexer-derived `feedbackVolume`, and the agent card
has name + services + supportedTrust — all three metadata markers.

```json
{
  "ok": true,
  "schemaVersion": "1.0.0",
  "agentId": "1",
  "resolvedAs": { "tokenId": "1", "kind": "id", "hint": null },
  "score": 86,
  "confidence": 0.954,
  "rating": "high",
  "signals": [
    { "name": "onChainSummary",  "value": 0.92,     "weight": 0.30, "source": "rpc",     "note": "getSummary returned summaryValue=92 decimals=0" },
    { "name": "feedbackVolume",  "value": 0.688618, "weight": 0.20, "source": "indexer", "note": "23 feedback events" },
    { "name": "uniqueClients",   "value": 0.75,     "weight": 0.15, "source": "indexer", "note": "15 unique clients (target ≥20)" },
    { "name": "recencyScore",    "value": 1.0,      "weight": 0.15, "source": "indexer", "note": "0.0d since last feedback" },
    { "name": "registrationAge", "value": 0.855707, "weight": 0.10, "source": "indexer", "note": "154d since registration" },
    { "name": "metadataQuality", "value": 1.0,      "weight": 0.10, "source": "rpc",     "note": "name=true services=true supportedTrust=true" }
  ],
  "ttlSeconds": 300,
  "meta": {
    "source": "mock",
    "onchainOsCalls": 0,
    "rpcCalls": 0,
    "chain": { "name": "xlayer", "id": 196, "rpc": "https://xlayerrpc.okx.com" },
    "contracts": {
      "identity":   "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
      "reputation": "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
      "validation": null
    }
  }
}
```

## 2. Low-rep agent (`--agent 9`)

**Verdict:** `score=36`, `confidence=0.78`, `rating=low`.

Same six signals, but `uniqueClients` is 0.05 (one repeat reviewer),
`onChainSummary` is 0.30, `registrationAge` is near zero (1-day-old agent),
and the agent card has only a `name`. Confidence stays above the
`unknown` threshold (0.25) because coverage is full — we're confidently
reporting that this agent hasn't earned much trust yet.

```json
{
  "ok": true, "agentId": "9", "score": 36, "confidence": 0.78, "rating": "low",
  "signals": [
    { "name": "onChainSummary",  "value": 0.30,     "weight": 0.30, "source": "rpc"     },
    { "name": "feedbackVolume",  "value": 0.300381, "weight": 0.20, "source": "indexer" },
    { "name": "uniqueClients",   "value": 0.05,     "weight": 0.15, "source": "indexer" },
    { "name": "recencyScore",    "value": 1.0,      "weight": 0.15, "source": "indexer" },
    { "name": "registrationAge", "value": 0.005708, "weight": 0.10, "source": "indexer" },
    { "name": "metadataQuality", "value": 0.5,      "weight": 0.10, "source": "rpc"     }
  ],
  "meta": { "source": "mock", "onchainOsCalls": 0, "rpcCalls": 0 }
}
```

## 3. Unknown agent (`--agent 999`)

**Verdict:** `score=0`, `confidence=0`, `rating=unknown`.

No registration event, no feedback, no card — the fixture is intentionally
empty, and the skill returns an empty `signals[]` plus `rating=unknown`
instead of falsely reporting 0/low. This is the distinction that matters
for integrators: a brand-new agent should surface differently from a
bad one.

```json
{
  "ok": true,
  "agentId": "999",
  "score": 0,
  "confidence": 0,
  "rating": "unknown",
  "signals": [],
  "meta": { "source": "mock", "onchainOsCalls": 0, "rpcCalls": 0 }
}
```

---

## Running against live X Layer

With real credentials, swap `--mock` for `--source auto` (the default) or
`--source indexer` to force the OnChain OS path.

```bash
cp .env.example .env && $EDITOR .env     # set OKX_ONCHAINOS_* keys
node src/cli.js --agent 1 --pretty
# expect: meta.onchainOsCalls >= 3, meta.rpcCalls >= 1, meta.source = "mixed"

node src/cli.js --agent 1 --source indexer --pretty
# expect: meta.onchainOsCalls >= 3, meta.rpcCalls == 0, meta.source = "indexer"
```

Reputation events on X Layer can be cross-checked on the
[OKLink explorer](https://www.oklink.com/xlayer/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63)
against the skill's output.
