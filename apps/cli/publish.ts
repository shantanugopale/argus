import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeRef } from "../../engine/analyze-ref.ts";
import type { ScanRef } from "../../engine/types.ts";
import { buildLiveProviders } from "../../shell/connectors/providers.ts";
import { PackageNotFoundError } from "../../shell/connectors/npm-registry.ts";
import { RepoNotFoundError } from "../../shell/connectors/github-api.ts";
import { parseRef } from "../../shell/parse-ref.ts";
import { ArgusStore } from "../../shell/persistence/argus-store.ts";
import { collectTrendData } from "./collect-trend.ts";
import { colorAware, BOLD, CYAN, GRAY, YELLOW } from "./ui.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

export interface PublishOptions {
  out: string;
  top: number;
  days: number;
  refs: string[];
}

export async function runPublish(opts: PublishOptions): Promise<number> {
  const now = new Date().toISOString();
  const store = new ArgusStore();
  const providers = buildLiveProviders();

  console.log(colorAware(`  ARGUS · publish  ▸  ${now}`, BOLD));

  const trend = await collectTrendData(opts.days, opts.top);
  store.saveTrendSnapshot(trend, now);
  console.log(colorAware(`  ✓ trend  ·  ${trend.rows.length} spikes  ·  ${trend.repos.length} viral repos`, GRAY));

  const failure: string[] = [];
  await Promise.all(
    opts.refs.map((raw) => poolScan(raw, providers, now, store, failure))
  );
  for (const line of failure) console.log(colorAware(line, YELLOW));

  const scansMeta = store.listScansMeta();
  const snapshot = {
    generatedAt: now,
    mode: "static" as const,
    trend,
    scans: scansMeta
  };

  mkdirSync(opts.out, { recursive: true });
  const html = readFileSync(join(HERE, "..", "web", "index.html"), "utf8");
  writeFileSync(join(opts.out, "index.html"), html);
  writeFileSync(join(opts.out, "snapshot.json"), JSON.stringify(snapshot, null, 1));
  console.log(colorAware(`  ✓ dist written  ▸  ${join(process.cwd(), opts.out)}  (${scansMeta.length} scans, snapshot ${JSON.stringify(trend).length} B)`, CYAN));
  return 0;
}

async function poolScan(
  raw: string,
  providers: Parameters<typeof analyzeRef>[1]["providers"],
  now: string,
  store: ArgusStore,
  failure: string[]
): Promise<void> {
  let ref: ScanRef;
  try {
    ref = parseRef(raw);
  } catch (e) {
    failure.push(`  ✗ ${raw}: invalid ref (${e instanceof Error ? e.message : String(e)})`);
    return;
  }
  try {
    const report = await analyzeRef(ref, { providers, now });
    store.saveScan(report, now);
  } catch (e) {
    if (e instanceof PackageNotFoundError || e instanceof RepoNotFoundError) {
      failure.push(`  ✗ ${raw}: not resolvable (${e.message})`);
    } else {
      failure.push(`  ✗ ${raw}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
