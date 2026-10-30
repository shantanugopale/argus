import type { DbRangeResponse } from "./npm-downloads.ts";

export function parseRangeResponse(json: unknown, windowDays: number): number[] {
  const res = json as DbRangeResponse | undefined;
  const fetched = res?.downloads ?? [];

  const byDay = new Map<string, number>();
  for (const entry of fetched) {
    if (typeof entry?.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entry.day)) continue;
    const downloads = typeof entry.downloads === "number" && Number.isFinite(entry.downloads) && entry.downloads >= 0 ? Math.floor(entry.downloads) : 0;
    byDay.set(entry.day, downloads);
  }

  const series: number[] = [];
  const startMs = Date.parse(res?.start ?? "") || Date.parse((fetched[0] ?? {}).day ?? "") || Number.NaN;
  const endMs = Date.parse(res?.end ?? "") || Date.parse((fetched[fetched.length - 1] ?? {}).day ?? "") || Number.NaN;
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return new Array(windowDays).fill(0);
  }

  const DAY = 86_400_000;
  for (let t = startMs; t <= endMs; t += DAY) {
    const iso = new Date(t).toISOString().slice(0, 10);
    series.push(byDay.get(iso) ?? 0);
  }
  return series.length > 0 ? series : new Array(windowDays).fill(0);
}
