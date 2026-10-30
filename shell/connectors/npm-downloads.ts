import type { ProviderSnapshot } from "../../engine/types.ts";
import { fetchJson, snapshotOf } from "./http.ts";
import { parseRangeResponse } from "./range-parser.ts";

export interface DbRangeEntry {
  day: string;
  downloads: number;
}

export interface DbRangeResponse {
  start?: string;
  end?: string;
  downloads?: DbRangeEntry[];
}

export interface DownloadsSeries {
  name: string;
  series: number[];
  snapshot: ProviderSnapshot;
}

export async function fetchDownloadsRange(
  name: string,
  windowDays: number,
  ua: string,
  now: string
): Promise<DownloadsSeries> {
  const days = Math.max(2, Math.min(30, Math.floor(windowDays)));
  const DAY = 86_400_000;
  const end = new Date(Date.now() - DAY).toISOString().slice(0, 10);
  const start = new Date(Date.now() - (days + 1) * DAY).toISOString().slice(0, 10);
  const url = `https://api.npmjs.org/downloads/range/${start}:${end}/${encodeURIComponent(name)}`;

  const { json, digest } = await fetchJson(url, {
    headers: { "user-agent": ua },
    timeoutMs: 15_000,
    retries: 2
  });

  const snapshot = snapshotOf(`npm downloads range ${start}..${end}`, digest, now);

  return {
    name,
    series: parseRangeResponse(json, days),
    snapshot
  };
}
