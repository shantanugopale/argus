import type {
  NpmScanContext,
  OsAdvisories,
  ProviderSnapshot,
  ScanProviders,
  ScanRef,
  ScanReport,
  RepoScanContext,
  GithubRepoManifest
} from "./types.ts";
import { analyzeNpmPackage } from "./npm/analyze.ts";
import { analyzeGithubRepo } from "./repo/analyze.ts";
import { TOP_INDEX } from "./npm/top-index.ts";

export interface AnalyzeDeps {
  providers: ScanProviders;
  now: string;
}

export class UnsupportedScanTypeError extends Error {
  readonly refName: string;
  constructor(ref: ScanRef) {
    super(`Unsupported scan ref "${ref.name}" for ecosystem "${ref.ecosystem}"`);
    this.name = "UnsupportedScanTypeError";
    this.refName = ref.name;
  }
}

const MAX_DEP_SCANS = 6;

export async function analyzeRef(ref: ScanRef, deps: AnalyzeDeps): Promise<ScanReport> {
  if (ref.ecosystem === "npm") return analyzeNpmRef(ref.name, deps);
  if (ref.ecosystem === "github") return analyzeGithubRef(ref.name, deps);
  throw new UnsupportedScanTypeError(ref);
}

async function analyzeNpmRef(name: string, deps: AnalyzeDeps): Promise<ScanReport> {
  const pkg = await deps.providers.getNpmPackage(name, { includeMonth: true });

  let advisoryBundle: { data: OsAdvisories; snapshot: ProviderSnapshot } | null = null;
  try {
    advisoryBundle = await deps.providers.getAdvisories(name);
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
  return { ...scanned, snapshots, checkedAt: deps.now };
}

function manifestDepNames(manifest: GithubRepoManifest | null): string[] {
  if (!manifest) return [];
  const names = new Set<string>();
  for (const n of Object.keys(manifest.dependencies ?? {})) names.add(n);
  for (const n of Object.keys(manifest.devDependencies ?? {})) names.add(n);
  return [...names].sort();
}

async function analyzeNpmRefQuiet(
  name: string,
  deps: AnalyzeDeps,
  opts: { includeMonth?: boolean } = {}
): Promise<ScanReport | null> {
  try {
    const pkg = await deps.providers.getNpmPackage(name, { includeMonth: opts.includeMonth !== false });
    let advisoryBundle: { data: OsAdvisories; snapshot: ProviderSnapshot } | null = null;
    try {
      advisoryBundle = await deps.providers.getAdvisories(name);
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
    return { ...scanned, snapshots, checkedAt: deps.now };
  } catch {
    return null;
  }
}

async function analyzeGithubRef(fullName: string, deps: AnalyzeDeps): Promise<ScanReport> {
  const repo = await deps.providers.getGithubRepo(fullName);

  let trending: { repos: Array<{ repo: string; starsThisPeriod: number }>; snapshot: ProviderSnapshot } | null = null;
  try {
    trending = await deps.providers.getTrendingToday();
  } catch {
    trending = null;
  }

  const trendingRow = trending?.repos.find((r) => r.repo === repo.data.fullName || r.repo === fullName) ?? null;

  const depNames = manifestDepNames(repo.data.manifest).slice(0, MAX_DEP_SCANS);
  const depReports: ScanReport[] = await Promise.all(
    depNames.map((depName) => analyzeNpmRefQuiet(depName, deps, { includeMonth: false }))
  ).then((rs) => rs.filter((r): r is ScanReport => r !== null));

  const ctx: RepoScanContext = {
    repo: repo.data,
    trendingStarsToday: trendingRow?.starsThisPeriod ?? null,
    trendingAvailable: trending !== null,
    depReports,
    depsScanned: depNames,
    now: deps.now
  };

  const snapshots = [repo.snapshot, ...(trending ? [trending.snapshot] : [])];
  const scanned = analyzeGithubRepo(ctx);
  return { ...scanned, snapshots, checkedAt: deps.now };
}
