import { config as loadDotenv } from 'dotenv';

let cached = null;

function parseIntEnv(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function parseBoolEnv(value, fallback = false) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

export function loadEnv() {
  if (cached) return cached;
  loadDotenv({ quiet: true });
  const env = {
    OKX_ONCHAINOS_API_KEY: process.env.OKX_ONCHAINOS_API_KEY || '',
    OKX_ONCHAINOS_SECRET_KEY: process.env.OKX_ONCHAINOS_SECRET_KEY || '',
    OKX_ONCHAINOS_PASSPHRASE: process.env.OKX_ONCHAINOS_PASSPHRASE || '',
    ONCHAINOS_BASE_URL: process.env.ONCHAINOS_BASE_URL || 'https://www.oklink.com',
    XLAYER_RPC_URL: process.env.XLAYER_RPC_URL || 'https://xlayerrpc.okx.com',
    REPUTATION_REQUEST_TIMEOUT_MS: parseIntEnv(process.env.REPUTATION_REQUEST_TIMEOUT_MS, 12000, { min: 1000, max: 120000 }),
    REPUTATION_OKX_MAX_RETRIES: parseIntEnv(process.env.REPUTATION_OKX_MAX_RETRIES, 2, { min: 0, max: 6 }),
    REPUTATION_RPC_MAX_RETRIES: parseIntEnv(process.env.REPUTATION_RPC_MAX_RETRIES, 2, { min: 0, max: 6 }),
    REPUTATION_RETRY_BASE_MS: parseIntEnv(process.env.REPUTATION_RETRY_BASE_MS, 250, { min: 50, max: 10000 }),
    REPUTATION_ALERT_STDERR: parseBoolEnv(process.env.REPUTATION_ALERT_STDERR, false),
  };
  env.hasOnchainOsCreds = Boolean(
    env.OKX_ONCHAINOS_API_KEY && env.OKX_ONCHAINOS_SECRET_KEY && env.OKX_ONCHAINOS_PASSPHRASE
  );
  cached = Object.freeze(env);
  return cached;
}

export function resetEnvCache() {
  cached = null;
}
