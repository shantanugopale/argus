export type Ecosystem = "npm" | "github";

export interface ScanRef {
  ecosystem: Ecosystem;
  name: string;
}

export type VerdictClass = "SAFE" | "NEEDS_REVIEW" | "HIGH_RISK" | "CRITICAL";

export interface SignalFinding {
  id: string;
  title: string;
  points: number;
  floor?: VerdictClass;
  evidence: string;
  refs?: string[];
  severe: boolean;
}

export interface ProviderSnapshot {
  source: string;
  url: string;
  fetchedAt: string;
  digest: string;
  degraded: boolean;
}

export interface NpmPackageData {
  name: string;
  latest: string;
  description: string;
  maintainers: Array<{ name: string }>;
  time: Record<string, string>;
  latestPublishedAt: string | null;
  repositoryUrl: string | null;
  scripts: Record<string, string>;
  downloadsLastWeek: number | null;
  downloadsLastMonth: number | null;
}

export interface GithubRepoManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface GithubRepoData {
  fullName: string;
  stars: number;
  forks: number;
  openIssues: number;
  licenseSpdx: string | null;
  description: string;
  createdAt: string;
  pushedAt: string;
  topics: string[];
  ownerType: string;
  archived: boolean;
  manifest: GithubRepoManifest | null;
}

export interface TrendingRepoRowData {
  repo: string;
  starsThisPeriod: number;
  period: string;
}

export interface NpmScanContext {
  npm: NpmPackageData;
  advisories: OsAdvisories;
  topNames: ReadonlySet<string>;
  now: string;
  degradedProvider: boolean;
}

export interface RepoScanContext {
  repo: GithubRepoData;
  trendingStarsToday: number | null;
  trendingAvailable: boolean;
  depReports: ScanReport[];
  depsScanned: string[];
  now: string;
}

export type OsSeverity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export interface OsVuln {
  id: string;
  summary: string;
  severity: OsSeverity;
  refs: string[];
}

export interface OsAdvisories {
  vulns: OsVuln[];
}

export interface ScanProviders {
  getNpmPackage(name: string, opts?: { includeMonth?: boolean }): Promise<{ data: NpmPackageData; snapshot: ProviderSnapshot }>;
  getAdvisories(name: string): Promise<{ data: OsAdvisories; snapshot: ProviderSnapshot }>;
  getGithubRepo(fullName: string): Promise<{ data: GithubRepoData; snapshot: ProviderSnapshot }>;
  getTrendingToday(): Promise<{ repos: TrendingRepoRowData[]; snapshot: ProviderSnapshot }>;
}

export interface NpmScanContext {
  npm: NpmPackageData;
  advisories: OsAdvisories;
  topNames: ReadonlySet<string>;
  now: string;
  degradedProvider: boolean;
}

export interface ScanReport {
  ref: ScanRef;
  verdict: VerdictClass;
  score: number;
  findings: SignalFinding[];
  snapshots: ProviderSnapshot[];
  checkedAt: string;
}

export const DOC_URLS: Record<string, string> = {
  S10: "https://osv.dev",
  S20: "https://docs.npmjs.com/cli/v10/using-npm/scripts",
  S30: "https://docs.npmjs.com/about-semantic-versioning",
  S40: "https://docs.npmjs.com/adding-downloads-to-your-package",
  S60: "https://github.com/WService/argus/blob/main/docs/02-ARCHITECTURE.md",
  S70: "https://docs.npmjs.com/about-the-npm-registry",
  S80: "https://docs.npmjs.com/creating-a-package-json-file",
  S90: "https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository",
  S100: "https://github.com/trending",
  S110: "https://docs.npmjs.com/specifying-dependencies-and-devdependencies-in-a-package-json-file",
  S00: "https://github.com/WService/argus/blob/main/docs/03-THREAT-MODEL.md"
};

export const VERDICT_ORDER: readonly VerdictClass[] = ["SAFE", "NEEDS_REVIEW", "HIGH_RISK", "CRITICAL"];
