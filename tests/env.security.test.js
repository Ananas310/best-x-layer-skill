import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEnv, resetEnvCache } from '../src/util/env.js';
import { sanitizeErrorMessage } from '../src/util/security.js';

function withEnv(overrides, fn) {
  const previous = {};
  for (const [k, v] of Object.entries(overrides)) {
    previous[k] = process.env[k];
    if (v == null) delete process.env[k];
    else process.env[k] = String(v);
  }
  resetEnvCache();
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v == null) delete process.env[k];
      else process.env[k] = v;
    }
    resetEnvCache();
  }
}

test('loadEnv parses operational guard settings and clamps invalid input', () => {
  withEnv({
    REPUTATION_REQUEST_TIMEOUT_MS: '200',
    REPUTATION_OKX_MAX_RETRIES: '99',
    REPUTATION_RPC_MAX_RETRIES: '-7',
    REPUTATION_RETRY_BASE_MS: 'abc',
    REPUTATION_ALERT_STDERR: 'true',
  }, () => {
    const env = loadEnv();
    assert.equal(env.REPUTATION_REQUEST_TIMEOUT_MS, 1000);
    assert.equal(env.REPUTATION_OKX_MAX_RETRIES, 6);
    assert.equal(env.REPUTATION_RPC_MAX_RETRIES, 0);
    assert.equal(env.REPUTATION_RETRY_BASE_MS, 250);
    assert.equal(env.REPUTATION_ALERT_STDERR, true);
  });
});

test('sanitizeErrorMessage redacts known OnChain OS credentials', () => {
  const env = {
    OKX_ONCHAINOS_API_KEY: 'api-key-1234',
    OKX_ONCHAINOS_SECRET_KEY: 'secret-key-5678',
    OKX_ONCHAINOS_PASSPHRASE: 'passphrase-9012',
  };
  const message = 'bad auth api-key-1234 secret-key-5678 passphrase-9012';
  const redacted = sanitizeErrorMessage(message, env);
  assert.ok(!redacted.includes(env.OKX_ONCHAINOS_API_KEY));
  assert.ok(!redacted.includes(env.OKX_ONCHAINOS_SECRET_KEY));
  assert.ok(!redacted.includes(env.OKX_ONCHAINOS_PASSPHRASE));
  assert.match(redacted, /\[REDACTED\]/);
});
