# 8004 Agent Reputation Skill (OKX Build X – Skill Arena)

This project is now reset to a **concept-only state**.

## What this project is
A planned **Skill Arena** submission for the OKX Build X AI Hackathon.

## Core idea
Build a reusable skill that queries the **8004 protocol** to evaluate another agent’s reputation.

## Hackathon context
- Event: OKX Build X AI Hackathon
- Track: Skill Arena
- Type: reusable agent capability (not a full standalone app)
- Goal: provide a trust/reputation primitive that other agents can integrate before delegating work, routing funds, or accepting outputs.

## Proposed capability (high-level)
- Input: target agent identifier (address, handle, or protocol-specific ID)
- Process: query 8004 protocol reputation signals
- Output: normalized reputation report (score, confidence, signal breakdown, timestamp)

## Potential use cases
- Agent-to-agent trust checks before delegation
- Reputation-aware task routing
- Risk flags for low-trust or newly created agents
- Audit-friendly reputation snapshots for decision logs

## Deliverables to build next
- Protocol adapter for 8004 queries
- Score normalization schema
- CLI/API interface for other agents
- Caching + freshness policy
- Test suite + proof/demo artifacts

## Notes
Implementation was intentionally removed per request. This repository currently keeps only project-level direction and hackathon framing.
