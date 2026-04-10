## Project Name
NL Swap Copilot — Natural-language swap skill for X Layer

## Track
Skill Arena

## Contact
Telegram: @alanas_k

## Summary
NL Swap Copilot is a reusable agent skill that translates plain-English swap intent into safe, executable swap plans on X Layer via OnchainOS. It adds guardrails (notional caps, slippage policy, explicit confirmation flow) so agents can execute swaps more safely and consistently.

## What I Built
I built a modular intent-to-execution pipeline that parses user requests like “swap 0.005 OKB to USDT on X Layer,” validates risk constraints, and generates a deterministic command plan for quote and execution using OnchainOS tooling. The goal is to reduce parameter mistakes and make agent-driven DeFi operations easier to audit.

## How It Functions
1. Parse natural-language intent → amount, from token, to token, chain
2. Evaluate risk policy → max notional + slippage guard
3. Build execution plan:
   - balance check
   - quote check
   - execute swap with explicit wallet/chain/slippage
4. Keep human-in-the-loop confirmation for final execution

## OnchainOS / Uniswap Integration
- Module(s) used: OnchainOS Wallet + DEX Swap
- How integrated: wallet/account state check, quote path generation, and execution planning for on-chain swap flow on X Layer

## Proof of Work
- Agentic Wallet address: `0x95e9bb55204a71da2d6403c84b855eb3b7afd549`
- GitHub repo: https://github.com/Ananas310/best-x-layer-skill
- Deployment / live demo: CLI demo
- On-chain tx examples: https://web3.okx.com/explorer/x-layer/tx/0xaadef4a8a6579294775a2c0e44d0acc4948bd27ce5e5c0b373a1a9e8656e02e1

## Why It Matters
Most users think in intent (“swap X to Y”), not protocol parameters. This skill bridges that gap with reusable logic that other agents can adopt, improving reliability, safety, and usability for on-chain interactions.
