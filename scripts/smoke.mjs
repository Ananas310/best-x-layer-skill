#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const runtime = process.execPath;
const runLive = process.argv.includes('--live');
const strictLive = process.argv.includes('--strict-live') || process.env.SMOKE_STRICT_LIVE === '1';

function runCli(args) {
  const result = spawnSync(runtime, ['src/cli.js', ...args], {
    encoding: 'utf8',
    env: process.env,
  });
  const stdout = (result.stdout ?? '').trim();
  const stderr = (result.stderr ?? '').trim();
  if (result.error) {
    throw new Error(`failed to execute CLI: ${result.error.message}`);
  }
  if (!stdout) {
    throw new Error(`no JSON output for args "${args.join(' ')}"\nstderr: ${stderr}`);
  }
  let json;
  try {
    json = JSON.parse(stdout);
  } catch (err) {
    throw new Error(`invalid JSON output for args "${args.join(' ')}": ${err.message}\nstdout: ${stdout}\nstderr: ${stderr}`);
  }
  return { code: result.status ?? 1, json, stdout, stderr, args };
}

function expectMock(agent, expectedRating) {
  const run = runCli(['--agent', String(agent), '--mock']);
  assert.equal(run.code, 0, `mock run failed for agent ${agent}: ${run.stderr}`);
  assert.equal(run.json.ok, true, `expected ok:true for mock agent ${agent}`);
  assert.equal(run.json.rating, expectedRating, `unexpected rating for mock agent ${agent}`);
}

function checkOffline() {
  expectMock(1, 'high');
  expectMock(9, 'low');
  expectMock(999, 'unknown');
}

function checkLive() {
  const rpc = runCli(['--agent', '1', '--source', 'rpc']);
  const rpcErr = rpc.json?.error?.message ?? rpc.json?.meta?.rpcError?.message ?? '';
  assert.ok(
    !/clientAddresses required/i.test(String(rpcErr)),
    `rpc path still reverts on empty clientAddresses: ${rpcErr}`,
  );
  if (strictLive) {
    assert.equal(rpc.code, 0, `strict live check expected rpc run success; stderr=${rpc.stderr}`);
    assert.equal(rpc.json?.ok, true, 'strict live check expected rpc ok=true');
  }

  const auto = runCli(['--agent', '1', '--source', 'auto']);
  const autoErr = auto.json?.error?.message ?? auto.json?.meta?.rpcError?.message ?? '';
  assert.ok(
    !/clientAddresses required/i.test(String(autoErr)),
    `auto path still surfaces empty clientAddresses revert: ${autoErr}`,
  );
  if (strictLive) {
    assert.equal(auto.code, 0, `strict live check expected auto run success; stderr=${auto.stderr}`);
    assert.equal(auto.json?.ok, true, 'strict live check expected auto ok=true');
  }
}

try {
  checkOffline();
  process.stdout.write('smoke: offline checks passed\n');
  if (runLive) {
    checkLive();
    process.stdout.write('smoke: live checks passed\n');
  } else {
    process.stdout.write('smoke: skipped live checks (run with --live)\n');
  }
} catch (err) {
  process.stderr.write(`smoke: failed - ${err.message}\n`);
  process.exit(1);
}
