import { parseRef } from "../../shell/parse-ref.ts";
import { runScanRefs } from "./scan.ts";
import { runTrend } from "./trend.ts";
import { runWatch } from "./watch.ts";

function usage(): never {
  console.log(
    `
  ARGUS · supply-chain radar (v1.0.0)

  usage
    node apps/cli/argus.ts scan <ref> [more-refs...] [--json]
    node apps/cli/argus.ts trend [--top N] [--days N] [--json]
    node apps/cli/argus.ts watch [--interval-min N] [--top N] [--days N]

  refs
    npm:<package-name>            scan an npm package
    <package-name>                shorthand for npm:<package-name>
    gh:<owner>/<repo>             scan a GitHub repo

  trend
    velocity radar over the top npm packages + GitHub trending repos

  watch
    daemon mode: refresh trend + rescan persisted refs every N minutes,
    exporting verdict changes to .argus/ (default 15 min)

  exit codes
    scan: 0 SAFE | 10 NEEDS_REVIEW | 20 HIGH_RISK/CRITICAL | 3 not found | 5 error (4 reserved for full-degradation)
    trend/watch: 0 informational
`.trimStart()
  );
  process.exit(0);
}

const [, , command, ...rest] = process.argv;
const jsonFlagged = rest.includes("--json");
const restArgs = rest.filter((r) => r !== "--json");

if (command === "scan") {
  if (restArgs.length <= 0) usage();
  process.exitCode = await runScanRefs(restArgs.map(parseRef), { asJson: jsonFlagged });
} else if (command === "trend") {
  process.exitCode = await runTrend({
    days: readIntFlag(restArgs, "--days", 14),
    top: readIntFlag(restArgs, "--top", 15),
    asJson: jsonFlagged
  });
} else if (command === "watch") {
  process.exitCode = await runWatch({
    intervalMin: readIntFlag(restArgs, "--interval-min", 15),
    top: readIntFlag(restArgs, "--top", 15),
    days: readIntFlag(restArgs, "--days", 14)
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
