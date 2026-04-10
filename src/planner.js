export function planSwap(intent, opts = {}) {
  const {
    slippageBps = 100,
    wallet = "0x95e9bb55204a71da2d6403c84b855eb3b7afd549"
  } = opts;

  return {
    summary: `Swap ${intent.amount} ${intent.fromToken} -> ${intent.toToken} on ${intent.chain}`,
    commands: [
      `onchainos wallet balance --chain ${intent.chain}`,
      `onchainos swap quote --from-token ${intent.fromToken} --to-token ${intent.toToken} --amount ${intent.amount} --chain ${intent.chain} --slippage ${slippageBps}`,
      `onchainos swap execute --from-token ${intent.fromToken} --to-token ${intent.toToken} --amount ${intent.amount} --chain ${intent.chain} --wallet ${wallet} --slippage ${slippageBps}`
    ],
    notes: [
      "Run quote first and verify output amount.",
      "If approval is required, follow approve+swap sequence.",
      "Do not bypass confirmation prompts without explicit user consent."
    ]
  };
}
