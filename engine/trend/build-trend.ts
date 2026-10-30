import { analyzeSeries, median, type SeriesStats, type SpikeClass } from "./velocity.ts";

export interface TrendRow {
  name: string;
  spike: SpikeClass;
  latest: number;
  baseline: number;
  burstRatio: number;
  relativeRatio: number;
  cohortWide: boolean;
  growthPct: number | null;
}

export interface TrendingRepoRow {
  repo: string;
  starsThisPeriod: number;
  period: string;
}

export interface TrendReport {
  generatedAt: string;
  windowDays: number;
  rows: TrendRow[];
  repos: TrendingRepoRow[];
  snapshots: ProviderSnapshotRef[];
}

export interface ProviderSnapshotRef {
  source: string;
  digest: string;
}

export interface TrendContext {
  generatedAt: string;
  windowDays: number;
  seriesByName: ReadonlyMap<string, number[]>;
  repos: ReadonlyArray<TrendingRepoRow>;
  snapshotDigests?: ReadonlyArray<string>;
}

export function buildTrendReport(ctx: TrendContext): TrendReport {
  const rows: TrendRow[] = [];
  for (const [name, series] of ctx.seriesByName) {
    const stats: SeriesStats = analyzeSeries(series);
    if (stats.spike === "none" && stats.latest === 0) continue;
    const material = stats.spike !== "none" || stats.burstRatio >= 1.75;
    if (!material) continue;
    rows.push({
      name,
      spike: stats.spike,
      latest: stats.latest,
      baseline: Math.round(stats.baseline * 100) / 100,
      burstRatio: Math.round(stats.burstRatio * 100) / 100,
      relativeRatio: 0,
      cohortWide: false,
      growthPct: stats.growthPct === null ? null : Math.round(stats.growthPct * 10) / 10
    });
  }

  const spiking = rows.filter((r) => r.spike !== "none").map((r) => r.burstRatio);
  const cohortRatio = spiking.length >= 5 ? median(spiking) : 0;
  const systemic = cohortRatio >= 1.5;
  for (const r of rows) {
    r.relativeRatio = systemic ? Math.round((r.burstRatio / cohortRatio) * 100) / 100 : r.burstRatio;
    r.cohortWide = systemic;
  }

  const rankWeight: Record<SpikeClass, number> = { none: 0, rising: 1, hot: 2, exploding: 3 };
  rows.sort(
    (a, b) => rankWeight[b.spike] - rankWeight[a.spike] || b.relativeRatio - a.relativeRatio || b.latest - a.latest
  );

  return {
    generatedAt: ctx.generatedAt,
    windowDays: ctx.windowDays,
    rows,
    repos: [...ctx.repos].sort((a, b) => b.starsThisPeriod - a.starsThisPeriod),
    snapshots: (ctx.snapshotDigests ?? []).map((d) => ({ source: "npm downloads range", digest: d }))
  };
}
