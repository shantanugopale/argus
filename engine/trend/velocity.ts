export type SpikeClass = "none" | "rising" | "hot" | "exploding";

export interface SeriesStats {
  latest: number;
  baseline: number;
  burstRatio: number;
  growthPct: number | null;
  spike: SpikeClass;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

export function classifySpike(ratio: number, latest: number): SpikeClass {
  if (ratio >= 8 && latest >= 1_000) return "exploding";
  if (ratio >= 4 && latest >= 750) return "hot";
  if (ratio >= 2 && latest >= 500) return "rising";
  return "none";
}

export function analyzeSeries(series: ReadonlyArray<number>): SeriesStats {
  if (series.length < 2) {
    return { latest: series[0] ?? 0, baseline: 0, burstRatio: 0, growthPct: null, spike: "none" };
  }

  const latest = series[series.length - 1] ?? 0;
  const recent = series.slice(Math.max(0, series.length - 1 - 7), series.length - 1);
  const baseline = Math.max(median(recent.length > 0 ? recent : [0]), 1);
  const burstRatio = latest / baseline;

  const weekNow = sum(series.slice(-7));
  const weekPrev = sum(series.slice(-14, -7));
  const growthPct = weekPrev > 0 ? ((weekNow - weekPrev) / weekPrev) * 100 : null;

  return {
    latest,
    baseline,
    burstRatio,
    growthPct,
    spike: classifySpike(burstRatio, latest)
  };
}
