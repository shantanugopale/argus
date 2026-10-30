import { parseRef } from "../../shell/parse-ref.ts";
import { runScanRefs } from "./scan.ts";
import { runTrend } from "./trend.ts";

function usage(): never {
  console.log(
    `
  ARGUS · supply-chain radar (v0.1)

  usage
    node apps/cli/argus.ts scan <ref> [more-refs...] [--json]
    node apps/cli/argus.ts trend [--top N] [--days N] [--json]

  refs
    npm:<package-name>            scan an npm package
    <package-name>                shorthand for npm:<package-name>
    gh:<owner>/<repo>             scan a GitHub repo (Sprint 3)

  trend
    velocity radar over the top npm packages + GitHub trending repos

  exit codes
    scan: 0 SAFE | 10 NEEDS_REVIEW | 20 HIGH_RISK/CRITICAL | 3 not found | 5 error (4 reserved for full-degradation)
    trend: 0 informational
`.trimStart()
  );
  process.exit(0);
}

const [, , command, ...rest] = process.argv;
const jsonFlagged = rest.includes("--json");
const restArgs = rest.filter((r) => r !== "--json");

if (command === "help" || restArgs.length <= 0) usage();

if (command === "scan") {
  process.exitCode = await runScanRefs(restArgs.map(parseRef), { asJson: jsonFlagged });
} else if (command === "trend") {
  process.exitCode = await runTrend({
    days: readIntFlag(restArgs, "--days", 14),
    top: readIntFlag(restArgs, "--top", 15),
    asJson: jsonFlagged
  });
} else {
  usage();
}

function readIntFlag(args: string[], flag: string, fallback: number): number {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  const n = Number.parseInt(args[idx + 1] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
