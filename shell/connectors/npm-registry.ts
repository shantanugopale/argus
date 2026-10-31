import type { NpmPackageData, ProviderSnapshot } from "../../engine/types.ts";
import { fetchJson, HttpError, snapshotOf } from "./http.ts";


interface RegistryDoc {
  "dist-tags"?: Record<string, string>;
  time?: Record<string, string>;
  maintainers?: Array<{ name?: string; email?: string }>;
  description?: string;
  repository?: string | { url?: string };
  versions?: Record<string, { scripts?: Record<string, string> }>;
}

interface DownloadsPoint {
  downloads?: number;
}

export class PackageNotFoundError extends Error {
  readonly packageName: string;
  constructor(packageName: string) {
    super(`Package "${packageName}" not found in the npm registry`);
    this.name = "PackageNotFoundError";
    this.packageName = packageName;
  }
}

export interface NpmFetch {
  data: NpmPackageData;
  snapshot: ProviderSnapshot;
  snapshots: ProviderSnapshot[];
}

function normalizeRepositoryUrl(repo: RegistryDoc["repository"]): string | null {
  if (typeof repo === "string") return repo;
  if (repo && typeof repo === "object" && typeof repo.url === "string") return repo.url;
  return null;
}

export function parseNpmPackageData(
  name: string,
  json: unknown,
  weekJson: unknown | null,
  monthJson: unknown | null
): NpmPackageData {
  const data = json as RegistryDoc;
  const latest = data["dist-tags"]?.["latest"];
  if (typeof latest !== "string" || latest.length === 0) throw new PackageNotFoundError(name);

  const versionMeta = data.versions?.[latest];
  const scripts = versionMeta?.scripts ?? {};

  return {
    name,
    latest,
    description: typeof data.description === "string" ? data.description : "",
    maintainers: (data.maintainers ?? [])
      .map((m) => ({ name: typeof m.name === "string" ? m.name : "" }))
      .filter((m) => m.name.length > 0),
    time: data.time ?? {},
    latestPublishedAt: data.time?.[latest] ?? null,
    repositoryUrl: normalizeRepositoryUrl(data.repository),
    scripts,
    downloadsLastWeek: parseDownloadsLike(weekJson),
    downloadsLastMonth: parseDownloadsLike(monthJson)
  };
}

function parseDownloadsLike(json: unknown | null): number | null {
  const d = (json as DownloadsPoint | null | undefined)?.downloads;
  return typeof d === "number" && Number.isFinite(d) ? d : null;
}

export async function fetchNpmPackage(name: string, now: string, opts: { includeMonth?: boolean } = {}): Promise<NpmFetch> {
  const includeMonth = opts.includeMonth !== false;
  const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(name)}`;

  const doc = await fetchJson(registryUrl, { timeoutMs: 45_000 }).catch((e: unknown) => {
    if (e instanceof HttpError && e.status === 404) throw new PackageNotFoundError(name);
    throw e;
  });
  const { json } = doc;

  const [weekOrNull, monthOrNull] = await Promise.all([
    fetchJson(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`, {
      timeoutMs: 15_000
    }).catch(() => null),
    includeMonth
      ? fetchJson(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(name)}`, {
          timeoutMs: 15_000
        }).catch(() => null)
      : Promise.resolve(null)
  ]);
  const downloadsWeek = weekOrNull;
  const downloadsMonth = monthOrNull;

  const npm = parseNpmPackageData(name, json, downloadsWeek?.json ?? null, downloadsMonth?.json ?? null);

  const snapshot = snapshotOf(registryUrl, doc.digest, now);
  const extra: ProviderSnapshot[] = [];
  if (downloadsWeek) extra.push(snapshotOf("npm downloads last-week", downloadsWeek.digest, now));
  if (downloadsMonth) extra.push(snapshotOf("npm downloads last-month", downloadsMonth.digest, now));

  return { data: npm, snapshot, snapshots: [snapshot, ...extra] };
}
