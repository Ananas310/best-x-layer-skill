export function evaluateRisk(intent, config = {}) {
  const {
    maxSlippageBps = 100,
    maxNotionalUsd = 25,
    assumedPriceUsd = 85
  } = config;

  if (!intent.valid) {
    return { ok: false, reason: "Intent parsing failed" };
  }

  const estimatedNotional = intent.amount * assumedPriceUsd;
  if (estimatedNotional > maxNotionalUsd) {
    return {
      ok: false,
      reason: `Notional $${estimatedNotional.toFixed(2)} exceeds max $${maxNotionalUsd}`
    };
  }

  return {
    ok: true,
    checks: {
      maxSlippageBps,
      maxNotionalUsd,
      estimatedNotionalUsd: Number(estimatedNotional.toFixed(2))
    }
  };
}
