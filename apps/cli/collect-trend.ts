import { buildTrendReport, type TrendReport, type TrendingRepoRow } from "../../engine/trend/build-trend.ts";
import { fetchDownloadsRange } from "../../shell/connectors/npm-downloads.ts";
import { fetchGithubTrending } from "../../shell/connectors/github-trending.ts";
import { POPULAR_NAMES } from "../../engine/npm/top-index.ts";
import { makePool } from "../../shell/lib/pool.ts";

export async function collectTrendData(days: number, top: number): Promise<TrendReport> {
  const now = new Date().toISOString();
  const names = POPULAR_NAMES.slice(0, top);

  const pool = makePool(6);
  const seriesResults = await Promise.all(
    names.map((name) =>
      pool.executeWithLimit(async () => {
        try {
          return await fetchDownloadsRange(name, days, "argus-supply-chain-radar/+npm-collector", now);
        } catch {
          return null;
        }
      })
    )
  );

  let trendingRepos: TrendingRepoRow[] = [];
  try {
    const gh = await fetchGithubTrending(now);
    trendingRepos = gh.repos.map((r) => ({ repo: r.repo, starsThisPeriod: r.starsThisPeriod, period: r.period }));
  } catch {
    trendingRepos = [];
  }

  const seriesByName = new Map<string, number[]>();
  const digests: string[] = [];
  for (const r of seriesResults) {
    if (!r) continue;
    seriesByName.set(r.name, r.series);
    digests.push(r.snapshot.digest.slice(0, 12));
  }

  return buildTrendReport({
    generatedAt: now,
    windowDays: days,
    seriesByName,
    repos: trendingRepos,
    snapshotDigests: digests
  });
}
