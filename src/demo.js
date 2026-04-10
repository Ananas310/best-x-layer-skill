import { parseIntent } from "./intent.js";
import { evaluateRisk } from "./risk.js";
import { planSwap } from "./planner.js";

const input = process.argv.slice(2).join(" ") || "swap 0.002 okb to usdt on xlayer";

const intent = parseIntent(input);
console.log("\n[Intent]\n", intent);

const risk = evaluateRisk(intent, {
  maxSlippageBps: Number(process.env.MAX_SLIPPAGE_BPS || 100),
  maxNotionalUsd: Number(process.env.MAX_NOTIONAL_USD || 25)
});
console.log("\n[Risk]\n", risk);

if (!risk.ok) {
  console.log("\nBlocked by risk policy:", risk.reason);
  process.exit(1);
}

const plan = planSwap(intent, {
  slippageBps: Number(process.env.MAX_SLIPPAGE_BPS || 100)
});
console.log("\n[Execution Plan]\n", JSON.stringify(plan, null, 2));
