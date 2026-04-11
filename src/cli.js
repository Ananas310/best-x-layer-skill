#!/usr/bin/env node
// Thin CLI wrapper around getReputation(). JSON → stdout. Logs → stderr.
// Exits 0 on ok:true, 1 on ok:false.
//
// Usage:
//   node src/cli.js --agent 1 [--mock] [--source auto|indexer|rpc|mock]
//                   [--clients 0xa,0xb] [--raw] [--pretty] [--ttl 300]

import { getReputation } from './index.js';

function parseArgs(argv) {
  const opts = {
    agent: null,
    source: 'auto',
    clients: [],
    raw: false,
    pretty: false,
    ttl: 300,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--agent': case '-a': opts.agent = next(); break;
      case '--source': case '-s': opts.source = next(); break;
      case '--mock': opts.source = 'mock'; break;
      case '--clients': opts.clients = next().split(',').map(s => s.trim()).filter(Boolean); break;
      case '--raw': opts.raw = true; break;
      case '--pretty': case '-p': opts.pretty = true; break;
      case '--ttl': opts.ttl = Number(next()); break;
      case '--help': case '-h': opts.help = true; break;
      default:
        if (!opts.agent && !a.startsWith('-')) opts.agent = a;
        else process.stderr.write(`warn: unknown arg "${a}"\n`);
    }
  }
  return opts;
}

const HELP = `
8004 reputation skill — read-only agent trust lookup on X Layer.

Usage:
  node src/cli.js --agent <id|0xaddress|handle> [options]

Options:
  --agent, -a <value>   Target agent (numeric tokenId, 0x address, or handle)
  --source, -s <mode>   auto | indexer | rpc | mock   (default: auto)
  --mock                Shortcut for --source mock
  --clients <a,b,...>   Filter getSummary() to these trusted reviewer addresses
                         (default: auto-use getClients(agentId))
  --raw                 Include the raw event + rpc bundle in the output
  --pretty, -p          Pretty-print JSON (2-space indent)
  --ttl <seconds>       Suggested cache TTL in the output (default: 300)
  --help, -h            Show this help

Examples:
  node src/cli.js --agent 1 --mock --pretty
  node src/cli.js --agent 1 --source indexer
  node src/cli.js --agent 0xabcd...01 --pretty
`;

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.agent) {
    process.stderr.write(HELP);
    process.exit(opts.help ? 0 : 1);
  }
  const report = await getReputation(opts.agent, {
    source: opts.source,
    includeRaw: opts.raw,
    clientAddresses: opts.clients,
    ttlSeconds: opts.ttl,
  });
  const out = opts.pretty ? JSON.stringify(report, null, 2) : JSON.stringify(report);
  process.stdout.write(out + '\n');
  process.exit(report.ok ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`fatal: ${err?.stack ?? err}\n`);
  process.exit(1);
});
