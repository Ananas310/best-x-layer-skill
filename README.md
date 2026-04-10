# NL Swap Copilot (Skill Arena Submission)

A reusable agent skill for **natural-language token swaps on X Layer** using OnchainOS.

## Track
Skill Arena (OKX Build X Hackathon)

## What this does
- Takes plain-English swap intent (e.g., "swap 0.005 OKB to USDT on X Layer")
- Parses amount / token pair / chain from text
- Fetches quote + route via OnchainOS
- Enforces configurable safety guards (max slippage, max notional)
- Produces executable command plan for wallet-assisted swap execution

## Why this is useful
Most users can describe what they want, but not exact CLI/API parameters. This skill is an adapter layer between human intent and reliable, auditable swap execution.

## Project status
- [x] Initial scaffold
- [x] Intent parser + risk checks
- [x] Command planner
- [ ] Live swap execution loop tests
- [ ] Submission post + demo artifacts

## Quick start

```bash
cd skill-arena-swap-copilot
cp .env.example .env
npm install
npm run demo -- "swap 0.002 okb to usdt on xlayer"
```

## Safety defaults
- maxSlippageBps: 100 (1%)
- maxNotionalUsd: 25
- allowChains: xlayer

## Hackathon proof placeholders
- Agentic Wallet address: `0x95e9bb55204a71da2d6403c84b855eb3b7afd549`
- Repo: (to be created)
- Demo: (to be added)
