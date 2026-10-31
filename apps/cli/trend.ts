import type { TrendReport } from "../../engine/trend/build-trend.ts";
import { colorAware, BOLD, DIM, GRAY, RED, YELLOW, GREEN, CYAN } from "./ui.ts";
import { collectTrendData } from "./collect-trend.ts";

export interface TrendOptions {
  days: number;
  top: number;
  asJson: boolean;
}

export async function runTrend(opts: TrendOptions): Promise<number> {
  const report = await collectTrendData(opts.days, opts.top);

  if (opts.asJson) {
    console.log(JSON.stringify(report, null, 2));
    return 0;
  }
  return renderTrend(report);
}

const SPIKE_MARK: Record<string, string> = {
  exploding: "▲▲ exploding",
  hot: "▲ hot",
  rising: "△ rising",
  none: "·"
};

const SPIKE_COLOR: Record<string, string> = {
  exploding: RED,
  hot: YELLOW,
  rising: YELLOW,
  none: GREEN
};

function renderTrend(report: TrendReport): number {
  console.log("");
  console.log(colorAware("  ARGUS · trend radar", BOLD) + colorAware(`  past ${report.windowDays} days  ·  ${report.generatedAt}`, CYAN));

  console.log("");
  console.log(colorAware(`  DOWNLOAD SPIKES (${report.rows.length} of radar window)`, DIM));
  if (report.rows.length === 0) {
    console.log(colorAware("  no anomalous spikes detected in the current cohort", GRAY));
  } else {
    for (const [i, row] of report.rows.slice(0, 15).entries()) {
      const mark = colorAware(SPIKE_MARK[row.spike] ?? "·", SPIKE_COLOR[row.spike] ?? GREEN);
      const pct = row.growthPct === null ? "" : `  ${row.growthPct >= 0 ? "+" : ""}${row.growthPct.toFixed(1)}%`;
      const ratioLabel = row.cohortWide ? `${row.relativeRatio.toFixed(2)}x rel` : `${row.burstRatio.toFixed(2)}x`;
      console.log(
        `  ${String(i + 1).padStart(2)}. ${row.name.padEnd(24)} ${mark}  ${ratioLabel}  ${row.latest.toLocaleString("en-US")}/day${pct}  @${row.baseline.toLocaleString("en-US")}/d`
      );
    }
    if (report.rows[0]?.cohortWide) {
      console.log(colorAware("      cohort note: median burst across radar is ≥1.5x — ratios shown relative to cohort", DIM));
    }
    console.log(colorAware("      spike = daily downloads vs 7-day median. run: node apps/cli/argus.ts scan <pkg>", DIM));
  }

  console.log("");
  console.log(colorAware(`  VIRAL GITHUB REPOS (last 24h)`, DIM));
  if (report.repos.length === 0) {
    console.log(colorAware("  trending feed unavailable right now (rate-limited or blocked)", GRAY));
  } else {
    for (const r of report.repos.slice(0, 8)) {
      console.log(`  - ${r.repo.padEnd(40)} ★${r.starsThisPeriod.toLocaleString("en-US")} ${r.period}`);
    }
  }

  console.log("");
  console.log(colorAware("  exit 0 — informational surface; scan a ref for verdicts + exit payload", DIM));
  return 0;
}
