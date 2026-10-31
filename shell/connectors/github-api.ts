import type { GithubRepoData, ProviderSnapshot, TrendingRepoRowData } from "../../engine/types.ts";
import { parseGithubRepoDoc, parseRepoManifest } from "../../engine/lib/parse-repo.ts";
import { fetchJson, HttpError, snapshotOf, fetchText } from "./http.ts";
import { parseTrendingHtml, unescapeLookalikes } from "./github-trending.ts";

export class RepoNotFoundError extends Error {
  readonly fullName: string;
  constructor(fullName: string) {
    super(`Repository "${fullName}" not found or not accessible (private repos are never scanned)`);
    this.name = "RepoNotFoundError";
    this.fullName = fullName;
  }
}

export interface GithubRepoFetch {
  data: GithubRepoData;
  snapshot: ProviderSnapshot;
  snapshots: ProviderSnapshot[];
}

export async function fetchGithubRepo(fullName: string, now: string): Promise<GithubRepoFetch> {
  const token = process.env["GITHUB_TOKEN"];
  const headers: Record<string, string> = { accept: "application/vnd.github+json" };
  if (token) headers["authorization"] = `Bearer ${token}`;

  const url = `https://api.github.com/repos/${fullName}`;
  const doc = await fetchJson(url, { headers, timeoutMs: 15_000 }).catch((e: unknown) => {
    if (e instanceof HttpError && e.status === 404) throw new RepoNotFoundError(fullName);
    throw e;
  });

  const headUrl = `https://raw.githubusercontent.com/${fullName}/HEAD/package.json`;
  const manifestRes = await fetchText(headUrl, { headers: {}, timeoutMs: 15_000, retries: 0 }).catch(() => null);
  const manifest = manifestRes ? parseRepoManifest(JSON.parse(manifestRes.text)) : null;

  const snapshot = snapshotOf(url, doc.digest, now);
  const snapshots = [snapshot];
  if (manifestRes) snapshots.push(snapshotOf(headUrl, manifestRes.digest, now));

  return {
    data: parseGithubRepoDoc(doc.json, manifest, fullName),
    snapshot,
    snapshots
  };
}

export async function fetchTrendingToday(now: string): Promise<{ repos: TrendingRepoRowData[]; snapshot: ProviderSnapshot }> {
  const { text, digest } = await fetchText("https://github.com/trending?since=daily", {
    timeoutMs: 20_000,
    retries: 2
  });
  const repos: TrendingRepoRowData[] = parseTrendingHtml(text).map((r) => ({
    repo: unescapeLookalikes(r.repo),
    starsThisPeriod: r.starsThisPeriod,
    period: r.period
  }));
  return { repos, snapshot: snapshotOf("github trending 24h", digest, now) };
}
