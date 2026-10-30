import type {
  NpmScanContext,
  OsAdvisories,
  ProviderSnapshot,
  ScanProviders,
  ScanRef,
  ScanReport
} from "./types.ts";
import { analyzeNpmPackage } from "./npm/analyze.ts";
import { TOP_INDEX } from "./npm/top-index.ts";

export interface AnalyzeDeps {
  providers: ScanProviders;
  now: string;
}

export class UnsupportedScanTypeError extends Error {
  constructor(ref: ScanRef) {
    super(`Sprint 1 scans npm packages only — received ecosystem "${ref.ecosystem}" (${ref.name})`);
    this.name = "UnsupportedScanTypeError";
  }
}

export async function analyzeRef(ref: ScanRef, deps: AnalyzeDeps): Promise<ScanReport> {
  if (ref.ecosystem !== "npm") throw new UnsupportedScanTypeError(ref);

  const pkg = await deps.providers.getNpmPackage(ref.name);

  let advisoryBundle: { data: OsAdvisories; snapshot: ProviderSnapshot } | null = null;
  try {
    advisoryBundle = await deps.providers.getAdvisories(ref.name);
  } catch {
    advisoryBundle = null;
  }

  const ctx: NpmScanContext = {
    npm: pkg.data,
    advisories: advisoryBundle?.data ?? { vulns: [] },
    topNames: TOP_INDEX,
    now: deps.now,
    degradedProvider: advisoryBundle === null
  };

  const snapshots = [pkg.snapshot, ...(advisoryBundle?.snapshot ? [advisoryBundle.snapshot] : [])];
  const scanned = analyzeNpmPackage(ctx);
  return {
    ...scanned,
    snapshots,
    checkedAt: deps.now
  };
}
