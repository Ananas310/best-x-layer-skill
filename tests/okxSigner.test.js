import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { signOkxRequest } from '../src/adapters/okxSigner.js';

// Known-vector: we compute the expected signature the same way here, but
// with a pinned timestamp + inputs. If someone changes the prehash shape
// (e.g., URL-encodes the path), this test fails.
test('signOkxRequest produces stable HMAC-SHA256 base64 over timestamp+method+path+body', () => {
  const inputs = {
    method: 'GET',
    requestPath: '/api/v5/explorer/log/by-address-and-topic?chainShortName=xlayer&address=0xabc&topic0=0xdef',
    body: '',
    secret: 'TEST_SECRET_0123456789',
    passphrase: 'TEST_PASSPHRASE',
    apiKey: 'TEST_KEY',
    timestamp: '2026-04-11T12:00:00.000Z',
  };
  const expectedPrehash = `${inputs.timestamp}GET${inputs.requestPath}`;
  const expectedSign = createHmac('sha256', inputs.secret).update(expectedPrehash).digest('base64');

  const headers = signOkxRequest(inputs);
  assert.equal(headers['OK-ACCESS-KEY'], 'TEST_KEY');
  assert.equal(headers['OK-ACCESS-PASSPHRASE'], 'TEST_PASSPHRASE');
  assert.equal(headers['OK-ACCESS-TIMESTAMP'], inputs.timestamp);
  assert.equal(headers['OK-ACCESS-SIGN'], expectedSign);
  // Sanity: base64 never contains + or / collision with url-unsafe chars is fine for header value.
  assert.match(headers['OK-ACCESS-SIGN'], /^[A-Za-z0-9+/]+=*$/);
});

test('signOkxRequest throws on missing credentials', () => {
  assert.throws(() => signOkxRequest({ method: 'GET', requestPath: '/x', secret: '', apiKey: 'k', passphrase: 'p' }), /missing secret/);
  assert.throws(() => signOkxRequest({ method: 'GET', requestPath: '/x', secret: 's', apiKey: '', passphrase: 'p' }), /missing apiKey/);
  assert.throws(() => signOkxRequest({ method: 'GET', requestPath: '/x', secret: 's', apiKey: 'k', passphrase: '' }), /missing passphrase/);
});

test('signOkxRequest includes body in prehash for POST', () => {
  const ts = '2026-04-11T12:00:00.000Z';
  const body = '{"a":1}';
  const headers = signOkxRequest({
    method: 'POST', requestPath: '/api/v5/foo', body,
    secret: 's', apiKey: 'k', passphrase: 'p', timestamp: ts,
  });
  const expected = createHmac('sha256', 's').update(`${ts}POST/api/v5/foo${body}`).digest('base64');
  assert.equal(headers['OK-ACCESS-SIGN'], expected);
});
