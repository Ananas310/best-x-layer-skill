// Maps the user-supplied agentId input to a canonical numeric tokenId.
//
// Accepted forms:
//   - "1", "42"                              → literal tokenId
//   - "0xAbCd...ABCD" (40-hex)               → owner address → scan Registered events
//   - anything else (handle / name)          → best-effort agent-card name match
//
// Returns { tokenId: string, kind: 'id'|'address'|'handle', hint: string|null }.
// Throws a plain Error with `.code` from ErrorCode on invalid / not-found.

import { ErrorCode } from './errors.js';
import { resolveTokenIdFromAddress, fetchReputationBundle, mockBundle } from '../adapters/8004Client.js';

const ID_RE = /^\d+$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function err(code, message, hint) {
  const e = new Error(message);
  e.code = code;
  if (hint) e.hint = hint;
  return e;
}

export function classifyInput(raw) {
  const input = String(raw ?? '').trim();
  if (!input) return { kind: 'invalid', value: '' };
  if (ID_RE.test(input)) return { kind: 'id', value: input };
  if (ADDRESS_RE.test(input)) return { kind: 'address', value: input.toLowerCase() };
  return { kind: 'handle', value: input };
}

export async function resolveAgentId(rawInput, {
  source = 'auto',
  env,
  counters,
  signal,
} = {}) {
  const classified = classifyInput(rawInput);

  if (classified.kind === 'invalid') {
    throw err(ErrorCode.INVALID_INPUT, 'agentId is required', 'pass a tokenId, 0x address, or handle');
  }

  if (classified.kind === 'id') {
    return { tokenId: classified.value, kind: 'id', hint: null };
  }

  if (source === 'mock') {
    // Mock mode: any address/handle maps to the high-rep fixture for demo convenience.
    const bundle = mockBundle('1');
    return { tokenId: bundle.tokenId, kind: classified.kind, hint: 'mock fixture' };
  }

  if (classified.kind === 'address') {
    const tokenId = await resolveTokenIdFromAddress(classified.value, { env, counters, signal });
    if (!tokenId) {
      throw err(
        ErrorCode.AGENT_NOT_FOUND,
        `no Registered event found for address ${classified.value}`,
        'address may not own an ERC-8004 Identity NFT on X Layer',
      );
    }
    return { tokenId, kind: 'address', hint: `owner=${classified.value}` };
  }

  // Handle path: best-effort. We do not scan 200 events here yet — the skill
  // documents this as slow and falls back to a friendly error if the handle
  // does not match a known agent card. We attempt a direct number parse first
  // (e.g. "agent#42") and otherwise throw so the caller can surface a hint.
  const numberMatch = classified.value.match(/\d+/);
  if (numberMatch) {
    const guess = numberMatch[0];
    try {
      const bundle = await fetchReputationBundle({ tokenId: guess, source, env, counters, signal });
      const cardName = bundle?.rpc?.card?.name;
      if (cardName && cardName.toLowerCase() === classified.value.toLowerCase()) {
        return { tokenId: guess, kind: 'handle', hint: `matched card.name=${cardName}` };
      }
    } catch {}
  }
  throw err(
    ErrorCode.AGENT_NOT_FOUND,
    `handle resolution is best-effort and could not match "${classified.value}"`,
    'prefer passing a numeric tokenId or the agent owner 0x address',
  );
}
