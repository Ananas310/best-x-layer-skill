import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyInput, resolveAgentId } from '../src/core/resolve.js';
import { ErrorCode } from '../src/core/errors.js';

test('classifyInput handles numeric ids, addresses, handles, and empty', () => {
  assert.deepEqual(classifyInput('42'), { kind: 'id', value: '42' });
  assert.deepEqual(classifyInput('  7 '), { kind: 'id', value: '7' });
  assert.deepEqual(
    classifyInput('0xAbCdEfABCDEFabcdefabcdefABCDEFabcdefABCD'),
    { kind: 'address', value: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' },
  );
  assert.deepEqual(classifyInput('some-agent'), { kind: 'handle', value: 'some-agent' });
  assert.deepEqual(classifyInput(''), { kind: 'invalid', value: '' });
  assert.deepEqual(classifyInput(null), { kind: 'invalid', value: '' });
});

test('resolveAgentId returns literal tokenId for numeric input', async () => {
  const out = await resolveAgentId('42', { source: 'mock' });
  assert.equal(out.tokenId, '42');
  assert.equal(out.kind, 'id');
});

test('resolveAgentId returns high-rep fixture for address in mock mode', async () => {
  const out = await resolveAgentId('0x1111111111111111111111111111111111111111', { source: 'mock' });
  assert.equal(out.tokenId, '1');
  assert.equal(out.kind, 'address');
  assert.match(out.hint, /mock/);
});

test('resolveAgentId throws INVALID_INPUT on empty input', async () => {
  await assert.rejects(
    () => resolveAgentId('', { source: 'mock' }),
    (err) => err.code === ErrorCode.INVALID_INPUT,
  );
});

test('resolveAgentId handle in mock mode falls back to high-rep fixture for demo convenience', async () => {
  const out = await resolveAgentId('definitely-not-a-real-agent', { source: 'mock' });
  assert.equal(out.tokenId, '1');
  assert.equal(out.kind, 'handle');
});
