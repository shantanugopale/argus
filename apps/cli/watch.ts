import type { ScanReport, ScanRef } from "../../engine/types.ts";
import { analyzeRef } from "../../engine/analyze-ref.ts";
import { buildLiveProviders } from "../../shell/connectors/providers.ts";
import { PackageNotFoundError } from "../../shell/connectors/npm-registry.ts";
import { RepoNotFoundError } from "../../shell/connectors/github-api.ts";
import { UnsupportedRefError } from "../../shell/parse-ref.ts";
import { parseRef } from "../../shell/parse-ref.ts";
import { ArgusStore } from "../../shell/persistence/argus-store.ts";
import { collectTrendData } from "./collect-trend.ts";
import { colorAware, BOLD, DIM, GRAY, YELLOW, CYAN } from "./ui.ts";

export interface WatchOptions {
  intervalMin: number;
  top: number;
  days: number;
}

export async function runWatch(opts: WatchOptions): Promise<number> {
  const store = new ArgusStore();
  const providers = buildLiveProviders();

  console.log("");
  console.log(colorAware("  ARGUS · watch mode", BOLD) + colorAware(`  every ${opts.intervalMin} min  ·  Ctrl-C to stop`, CYAN));

  while (true) {
    const tickStarted = Date.now();
    try {
      await tick(opts, providers, store);
    } catch (e) {
      console.error(colorAware(`  watch tick failed: ${e instanceof Error ? e.message : String(e)}`, YELLOW));
    }

    const remainMs = Math.max(0, opts.intervalMin * 60_000 - (Date.now() - tickStarted));
    await new Promise((resolve) => setTimeout(resolve, remainMs));
  }
}

async function tick(
  opts: WatchOptions,
  providers: Parameters<typeof analyzeRef>[1]["providers"],
  store: ArgusStore
): Promise<void> {
  const now = new Date().toISOString();
  console.log("");
  console.log(colorAware(`  ▸ tick @ ${now}`, DIM));

  const persisted = store.listScansMeta();
  const prevVerdicts = new Map(persisted.map((p) => [p.ref, p.verdict]));

  for (const p of persisted) {
    let ref: ScanRef;
    try {
      ref = parseRef(p.ref);
    } catch (e) {
      if (!(e instanceof UnsupportedRefError)) console.error(colorAware(`  ✗ ${p.ref}: ${e instanceof Error ? e.message : String(e)}`, YELLOW));
      continue;
    }
    try {
      await rescanRef(ref, providers, now, store, prevVerdicts.get(p.ref));
    } catch (e) {
      if (e instanceof PackageNotFoundError || e instanceof RepoNotFoundError) {
        console.error(colorAware(`  ✗ ${p.ref}: no longer resolvable (${e.message})`, YELLOW));
      } else {
        console.error(colorAware(`  ✗ ${p.ref}: ${e instanceof Error ? e.message : String(e)}`, YELLOW));
      }
    }
  }

  try {
    const report = await collectTrendData(opts.days, opts.top);
    store.saveTrendSnapshot(report, now);
    const spikeCount = report.rows.length;
    console.log(colorAware(`  ✓ trend refreshed  ·  ${spikeCount} spikes  ·  ${report.repos.length} viral repos`, GRAY));
  } catch {
    console.error(colorAware("  ✗ trend refresh failed (providers flaky; keeping last snapshot)", YELLOW));
  }
}

async function rescanRef(
  ref: ScanRef,
  providers: Parameters<typeof analyzeRef>[1]["providers"],
  now: string,
  store: ArgusStore,
  prevVerdict: string | undefined
): Promise<void> {
  const report = await analyzeRef(ref, { providers, now });
  store.saveScan(report, now);
  logVerdictChange(report, prevVerdict);
}

function logVerdictChange(report: ScanReport, prevVerdict: string | undefined): void {
  const label = `${report.ref.name.padEnd(30)} ${report.verdict.padEnd(13)} ${report.score}/100`;
  if (prevVerdict && prevVerdict !== report.verdict) {
    console.log(colorAware(`  ★ ${label}  (was ${prevVerdict})`, YELLOW));
  } else {
    console.log(colorAware(`  · ${label}`, GRAY));
  }
}
