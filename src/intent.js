const TOKEN_ALIASES = {
  okb: "OKB",
  usdt: "USDT",
  usdc: "USDC",
  eth: "ETH",
  weth: "WETH"
};

export function parseIntent(input) {
  const text = input.trim().toLowerCase();

  const amountMatch = text.match(/(\d+(?:\.\d+)?)/);
  const amount = amountMatch ? Number(amountMatch[1]) : null;

  const pairMatch = text.match(/(?:swap|convert)\s+\d+(?:\.\d+)?\s+([a-z0-9]+)\s+(?:to|for)\s+([a-z0-9]+)/);
  const fromTokenRaw = pairMatch?.[1] ?? null;
  const toTokenRaw = pairMatch?.[2] ?? null;

  const chain = text.includes("xlayer") || text.includes("x layer") ? "xlayer" : "xlayer";

  const fromToken = fromTokenRaw ? (TOKEN_ALIASES[fromTokenRaw] || fromTokenRaw.toUpperCase()) : null;
  const toToken = toTokenRaw ? (TOKEN_ALIASES[toTokenRaw] || toTokenRaw.toUpperCase()) : null;

  return {
    raw: input,
    amount,
    fromToken,
    toToken,
    chain,
    valid: Boolean(amount && fromToken && toToken)
  };
}
