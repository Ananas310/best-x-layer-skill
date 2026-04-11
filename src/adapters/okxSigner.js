import { createHmac } from 'node:crypto';

// OKX v5 / OKLink / OnChain OS signing scheme.
// sign = base64( HMAC-SHA256( secret, timestamp + METHOD + requestPath + body ) )
// requestPath MUST include the query string exactly as sent.
export function signOkxRequest({ method, requestPath, body = '', secret, passphrase, apiKey, timestamp }) {
  if (!secret) throw new Error('okxSigner: missing secret');
  if (!apiKey) throw new Error('okxSigner: missing apiKey');
  if (!passphrase) throw new Error('okxSigner: missing passphrase');
  if (!method) throw new Error('okxSigner: missing method');
  if (!requestPath) throw new Error('okxSigner: missing requestPath');
  const ts = timestamp ?? new Date().toISOString();
  const prehash = `${ts}${method.toUpperCase()}${requestPath}${body}`;
  const sign = createHmac('sha256', secret).update(prehash).digest('base64');
  return {
    'OK-ACCESS-KEY': apiKey,
    'OK-ACCESS-SIGN': sign,
    'OK-ACCESS-TIMESTAMP': ts,
    'OK-ACCESS-PASSPHRASE': passphrase,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}
