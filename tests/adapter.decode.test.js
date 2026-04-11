import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeEventTopics, encodeAbiParameters, parseAbiParameters, keccak256, toHex, stringToHex, pad } from 'viem';
import { TOPICS, padTopicUint, padTopicAddress } from '../src/core/topics.js';
import { reputationAbi, identityAbi } from '../src/adapters/abis.js';
import { mockBundle, _selectSummaryClientAddresses } from '../src/adapters/8004Client.js';

test('topics.js hashes match viem keccak256 re-derivation', async () => {
  const expect = {
    'NewFeedback(uint256,address,uint64,int128,uint8,string,string,string,string,string,bytes32)': TOPICS.reputation.newFeedback,
    'Registered(uint256,string,address)': TOPICS.identity.registered,
    'URIUpdated(uint256,string,address)': TOPICS.identity.uriUpdated,
  };
  const { toBytes } = await import('viem');
  for (const [sig, expected] of Object.entries(expect)) {
    assert.equal(keccak256(toBytes(sig)), expected, `mismatch on ${sig}`);
  }
});

test('encodeEventTopics via ABI matches our precomputed topic0 for NewFeedback', () => {
  const topics = encodeEventTopics({ abi: reputationAbi, eventName: 'NewFeedback' });
  assert.equal(topics[0], TOPICS.reputation.newFeedback);
});

test('encodeEventTopics via ABI matches our precomputed topic0 for Registered', () => {
  const topics = encodeEventTopics({ abi: identityAbi, eventName: 'Registered' });
  assert.equal(topics[0], TOPICS.identity.registered);
});

test('padTopicUint pads agent id to 32-byte hex topic value', () => {
  assert.equal(padTopicUint(1), '0x0000000000000000000000000000000000000000000000000000000000000001');
  assert.equal(padTopicUint('0xff'), '0x00000000000000000000000000000000000000000000000000000000000000ff');
  assert.equal(padTopicUint(0n), '0x0000000000000000000000000000000000000000000000000000000000000000');
});

test('padTopicAddress lowercases and left-pads to 32 bytes', () => {
  assert.equal(
    padTopicAddress('0xAbCdEfABCDEFabcdefabcdefABCDEFabcdefABCD'),
    '0x000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcd',
  );
});

test('mockBundle returns deterministic fixture for each tokenId category', () => {
  const high = mockBundle('1');
  const low = mockBundle('9');
  const unk = mockBundle('999');
  assert.equal(high.tokenId, '1');
  assert.equal(high.events.feedback.length, 23);
  assert.equal(low.tokenId, '9');
  assert.equal(low.events.feedback.length, 3);
  assert.equal(unk.events.feedback.length, 0);
});

test('_selectSummaryClientAddresses prefers explicit clients and normalizes list', () => {
  const out = _selectSummaryClientAddresses(
    [' 0xAbCd ', '0xabcd', '', '0x1234 '],
    ['0x9999'],
  );
  assert.deepEqual(out, ['0xabcd', '0x1234']);
});

test('_selectSummaryClientAddresses falls back to rpc clients when explicit list is empty', () => {
  const out = _selectSummaryClientAddresses([], ['0xAAAA', '0xaaaa', '  ', '0xbbbb']);
  assert.deepEqual(out, ['0xaaaa', '0xbbbb']);
});

test('_selectSummaryClientAddresses returns empty when both inputs have no usable values', () => {
  const out = _selectSummaryClientAddresses(['', '   '], [null, undefined, '']);
  assert.deepEqual(out, []);
});
