// Topic0 hashes for ERC-8004 registry events on X Layer.
// Computed as keccak256(utf8(canonical_signature)) and verified against
// github.com/erc-8004/erc-8004-contracts ABIs (master branch).
//
// Run `ASSERT_TOPICS=1 node src/core/topics.js` to re-derive and assert
// these constants against viem's keccak256 — catches signature drift.

export const TOPICS = Object.freeze({
  reputation: Object.freeze({
    // NewFeedback(uint256 indexed agentId, address indexed client, uint64 feedbackIndex,
    //             int128 score, uint8 scoreDecimals, string indexed tag1, string tag2,
    //             string filehash, string fileuri, string uuid, bytes32 responseExtHash)
    newFeedback: '0x6a4a61743519c9d648a14e6493f47dbe3ff1aa29e7785c96c8326a205e58febc',
    // FeedbackRevoked(uint256 indexed agentId, address indexed client, uint64 indexed feedbackIndex)
    feedbackRevoked: '0x25156fd3288212246d8b008d5921fde376c71ed14ac2e072a506eb06fde6d09d',
    // ResponseAppended(uint256 indexed agentId, address indexed client, uint64 feedbackIndex,
    //                  address indexed responder, string response, bytes32 responseExtHash)
    responseAppended: '0xb1c6be0b5b8aef6539e2fac0fd131a2faa7b49edf8e505b5eb0ad487d56051d4',
  }),
  identity: Object.freeze({
    // Registered(uint256 indexed agentId, string agentURI, address indexed owner)
    registered: '0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a',
    // URIUpdated(uint256 indexed agentId, string agentURI, address indexed owner)
    uriUpdated: '0x3a2c7fffc2cba7582c690e3b82c453ea02a308326a98a3ad7576c606336409fb',
    // Transfer(address indexed from, address indexed to, uint256 indexed tokenId)  -- standard ERC-721
    transfer: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  }),
});

// Pads a decimal or 0x integer to a 32-byte hex topic value.
export function padTopicUint(value) {
  const hex = typeof value === 'bigint'
    ? value.toString(16)
    : /^0x/i.test(String(value))
      ? String(value).slice(2)
      : BigInt(value).toString(16);
  return '0x' + hex.padStart(64, '0');
}

// Pads a 20-byte address to a 32-byte hex topic value (left-padded with zeros, lowercase).
export function padTopicAddress(address) {
  const hex = String(address).toLowerCase().replace(/^0x/, '');
  if (hex.length !== 40) throw new Error(`padTopicAddress: expected 20-byte address, got ${address}`);
  return '0x' + hex.padStart(64, '0');
}

// Dev-only self-check: run `ASSERT_TOPICS=1 node src/core/topics.js`.
// Re-derives every topic0 via viem and crashes if any drift vs the constants above.
if (import.meta.url === `file://${process.argv[1]}` || process.env.ASSERT_TOPICS === '1') {
  const { keccak256, toBytes } = await import('viem');
  const expect = {
    'NewFeedback(uint256,address,uint64,int128,uint8,string,string,string,string,string,bytes32)': TOPICS.reputation.newFeedback,
    'FeedbackRevoked(uint256,address,uint64)': TOPICS.reputation.feedbackRevoked,
    'ResponseAppended(uint256,address,uint64,address,string,bytes32)': TOPICS.reputation.responseAppended,
    'Registered(uint256,string,address)': TOPICS.identity.registered,
    'URIUpdated(uint256,string,address)': TOPICS.identity.uriUpdated,
    'Transfer(address,address,uint256)': TOPICS.identity.transfer,
  };
  let fail = 0;
  for (const [sig, expected] of Object.entries(expect)) {
    const got = keccak256(toBytes(sig));
    if (got !== expected) {
      console.error(`TOPIC MISMATCH: ${sig}\n  expected ${expected}\n  got      ${got}`);
      fail++;
    }
  }
  if (fail) { console.error(`${fail} topic mismatches`); process.exit(1); }
  console.log('topics.js: all topic0 hashes verified via viem keccak256');
}
