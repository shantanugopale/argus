import type { ScanRef, ScanReport } from "../../engine/types.ts";
import { analyzeRef } from "../../engine/analyze-ref.ts";
import { buildLiveProviders } from "../../shell/connectors/providers.ts";
import { buildFixtureProviders, loadFixtureMeta } from "../../shell/connectors/fixtures.ts";
import { PackageNotFoundError } from "../../shell/connectors/npm-registry.ts";
import { RepoNotFoundError } from "../../shell/connectors/github-api.ts";
import { UnsupportedRefError } from "../../shell/parse-ref.ts";
import { ArgusStore } from "../../shell/persistence/argus-store.ts";
import { renderReports, EXIT_CODES } from "./render.ts";

export async function runScanRefs(refs: ScanRef[], opts: { asJson?: boolean } = {}): Promise<number> {
  const asJson = opts.asJson === true;
  const useCache = process.env["ARGUS_NO_CACHE"] !== "1" && !process.env["ARGUS_FIXTURES_DIR"];

  const fixturesDir = process.env["ARGUS_FIXTURES_DIR"];
  const nowEnv = process.env["ARGUS_NOW"];
  const now = nowEnv ?? new Date().toISOString();

  const providers = buildProviders(fixturesDir, now);
  const store = new ArgusStore();

  const reports: ScanReport[] = [];
  let exitCode = 0;

  for (const ref of refs) {
    const cached = useCache ? store.loadScan(ref.name, 60_000) : null;
    if (cached) {
      reports.push(cached.report);
      continue;
    }
    try {
      const report = await analyzeRef(ref, { providers, now });
      reports.push(report);
      if (useCache) store.saveScan(report, now);
    } catch (e) {
      if (e instanceof PackageNotFoundError || e instanceof RepoNotFoundError) {
        console.error(renderErrorPeskyLine(ref.name, `package not found in the registry: ${e.message}`));
        exitCode = Math.max(exitCode, EXIT_CODES.NOT_FOUND);
      } else if (e instanceof UnsupportedRefError || e instanceof Error && e.name === "UnsupportedScanTypeError") {
        console.error(renderErrorPeskyLine(ref.name, e.message));
        exitCode = Math.max(exitCode, EXIT_CODES.UNEXPECTED);
      } else {
        console.error(renderErrorPeskyLine(ref.name, e instanceof Error ? `${e.name}: ${e.message}` : String(e)));
        exitCode = Math.max(exitCode, EXIT_CODES.UNEXPECTED);
      }
    }
  }

  const rendered = renderReports(reports, asJson);
  return Math.max(exitCode, rendered);
}

function buildProviders(fixturesDir: string | undefined, now: string) {
  if (fixturesDir) {
    const meta = loadFixtureMeta(fixturesDir);
    return buildFixtureProviders(fixturesDir, meta.recordedAt);
  }
  void now;
  return buildLiveProviders();
}

function renderErrorPeskyLine(target: string, message: string): string {
  return `argus ▸ ${target}: ${message}`;
}
