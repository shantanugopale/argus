import type { ScanReport, VerdictClass } from "../../engine/types.ts";
import { BOLD, CYAN, DIM, GRAY, GREEN, RED, RESET, YELLOW, colorAware } from "./ui.ts";

const VERDICT_STYLE: Record<VerdictClass, string> = {
  CRITICAL: RED,
  HIGH_RISK: RED,
  NEEDS_REVIEW: YELLOW,
  SAFE: GREEN
};

const VERDICT_LABEL: Record<VerdictClass, string> = {
  CRITICAL: "CRITICAL — do not install",
  HIGH_RISK: "HIGH RISK — review before install",
  NEEDS_REVIEW: "NEEDS REVIEW",
  SAFE: "SAFE — no signals fired"
};

export const EXIT_CODES = {
  SAFE: 0,
  NEEDS_REVIEW: 10,
  HIGH_RISK: 20,
  CRITICAL: 20,
  NOT_FOUND: 3,
  NETWORK_DEGRADED: 4,
  UNEXPECTED: 5
} as const;

function exitCodeFor(verdict: VerdictClass): number {
  if (verdict === "NEEDS_REVIEW") return EXIT_CODES.NEEDS_REVIEW;
  if (verdict === "HIGH_RISK" || verdict === "CRITICAL") return EXIT_CODES.HIGH_RISK;
  return EXIT_CODES.SAFE;
}

function bar(score: number): string {
  const filled = Math.round(score / 10);
  const solid = "▮".repeat(filled);
  const empty = "▯".repeat(10 - filled);
  return `${solid}${empty}`;
}

function renderReport(report: ScanReport): number {
  const v = report.verdict;
  console.log("");
  console.log(colorAware("  ARGUS " + "· supply-chain radar", BOLD) + colorAware("  scan " + report.ref.ecosystem + ":" + report.ref.name, DIM));
  console.log("");
  console.log(
    "  verdict " +
      colorAware(bar(report.score), VERDICT_STYLE[v]) +
      `  ${report.score}/100 ` +
      colorAware(VERDICT_LABEL[v], BOLD + VERDICT_STYLE[v])
  );

  if (report.findings.length === 0) {
    console.log(colorAware("  no risk signals fired — evidence-weighted scan clean", GRAY));
  } else {
    console.log("");
    console.log(colorAware("  evidence", DIM));
    for (const f of report.findings) {
      const bullet = f.severe ? colorAware("◈", RED) : colorAware("◇", YELLOW);
      const pointsPart = f.points > 0 ? ` (+${f.points})` : "";
      console.log(`  ${bullet} ${colorAware(f.id, DIM)} ${colorAware(f.title, f.severe ? BOLD : RESET)}${pointsPart}`);
      console.log(colorAware(`      ${f.evidence}`, GRAY));
      if (f.refs && f.refs.length > 0 && f.refs[0]) {
        console.log(colorAware(`      ref: ${f.refs[0]}`, DIM));
      }
    }
    console.log("");
    console.log(`  score ${report.score} = Σ weighted findings  ${colorAware("30s re-scan caches in .argus/", DIM)}`);
  }

  const degraded = report.snapshots.filter((s) => s.degraded);
  if (degraded.length > 0) {
    console.log(colorAware(`  ⚠ degraded providers: ${degraded.map((d) => d.source).join(", ")} — verdict may be incomplete`, YELLOW));
  }

  console.log(colorAware(`  checked ${report.checkedAt} · providers ${report.snapshots.length} · digests logged for reproducibility`, DIM));
  return exitCodeFor(v);
}

function renderJson(report: ScanReport): number {
  console.log(JSON.stringify(report, null, 2));
  return exitCodeFor(report.verdict);
}

export function renderReports(reports: ScanReport[], asJson: boolean): number {
  let worst = 0;
  for (const r of reports) {
    const code = asJson ? renderJson(r) : renderReport(r);
    worst = Math.max(worst, code);
  }
  if (reports.length > 1 && !asJson) {
    const verdicts = reports.map((r) => r.verdict);
    const worstVerdict: VerdictClass =
      verdicts.includes("CRITICAL") ? "CRITICAL" : verdicts.includes("HIGH_RISK") ? "HIGH_RISK" : verdicts.includes("NEEDS_REVIEW") ? "NEEDS_REVIEW" : "SAFE";
    console.log("");
    console.log(colorAware(`  SUMMARY: ${reports.length} scanned, worst verdict ${VERDICT_LABEL[worstVerdict]}`, CYAN + BOLD) + RESET);
  }
  return worst;
}
