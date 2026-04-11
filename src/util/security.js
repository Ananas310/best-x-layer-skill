export function redactSecrets(value, secrets = []) {
  let out = String(value ?? '');
  for (const secret of secrets) {
    const raw = String(secret ?? '').trim();
    if (!raw || raw.length < 4) continue;
    out = out.split(raw).join('[REDACTED]');
  }
  return out;
}

export function sanitizeErrorMessage(message, env = {}) {
  return redactSecrets(message, [
    env.OKX_ONCHAINOS_API_KEY,
    env.OKX_ONCHAINOS_SECRET_KEY,
    env.OKX_ONCHAINOS_PASSPHRASE,
  ]);
}
