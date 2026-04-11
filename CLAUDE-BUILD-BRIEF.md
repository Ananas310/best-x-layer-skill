# Claude Build Brief — 8004 Reputation Skill

## Objective
Build a **Skill Arena** hackathon project: a reusable skill that queries the **8004 protocol** for another agent's reputation and returns a normalized trust report.

## Hackathon Context (minimal)
- Event: OKX Build X AI Hackathon
- Track: Skill Arena
- What judges care about: reusability, technical quality, practical usefulness, clear demo/proof

## Product Definition
This is **not** a full consumer app. It is a reusable module/skill for other agents.

Input:
- `agentId` (string)
- optional `network`/`domain`

Output (stable JSON):
- `agentId`
- `score` (0-100)
- `confidence` (0-1)
- `rating` (`high|medium|low|unknown`)
- `signals[]` (source signal name + value + weight)
- `fetchedAt` (ISO timestamp)
- `ttlSeconds`
- `raw` (original protocol response, optional)

## Non-goals
- No token swaps, wallets, or trading execution
- No large frontend UI
- No over-engineered microservices

## Required Architecture
- `src/adapters/8004Client.js` — protocol calls
- `src/core/normalize.js` — signal normalization
- `src/core/score.js` — score + confidence logic
- `src/index.js` — public API
- `src/cli.js` — CLI entry (query by agentId)
- `tests/` — unit tests for normalize + score

## Implementation Constraints
- Keep dependencies minimal
- All outputs deterministic for same input
- Fail gracefully with explicit error objects
- Add a mock/offline mode for demo when protocol endpoint unavailable

## CLI Contract
Example:
```bash
node src/cli.js --agent "agent_123"
```

Should print JSON only.

## Definition of Done
1. Can query an agent reputation (real or mock mode)
2. Returns normalized JSON schema above
3. Includes unit tests passing locally
4. Includes `docs/demo.md` with 3 sample runs
5. README explains purpose, quick start, and integration snippet

## Suggested Milestones
1. Implement adapter + mock response
2. Implement normalize/score engine
3. Implement CLI + API export
4. Add tests
5. Write docs + sample outputs

## Submission Positioning (for later)
- “Reusable trust primitive for agent-to-agent collaboration”
- “Pre-delegation reputation check for safer automation”
