import type { ProviderSnapshot } from "../../engine/types.ts";
import { fetchText, snapshotOf } from "./http.ts";
import { parseTrendingHtml, type TrendingRepo } from "./trending-parser.ts";

export { parseTrendingHtml };
export type { TrendingRepo };

export function unescapeLookalikes(text: string): string {
  return text.replace(/&#x2F;/g, "/").replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<");
}

export interface TrendingSnapshot {
  repos: TrendingRepo[];
  snapshot: ProviderSnapshot;
}

const DEFAULT_UA = "argus-supply-chain-radar/+npm-collector";

export async function fetchGithubTrending(
  now: string,
  ua: string = DEFAULT_UA
): Promise<TrendingSnapshot> {
  const url = "https://github.com/trending?since=daily";
  const headers: Record<string, string> = {
    "user-agent": ua,
    accept: "text/html,application/xhtml+xml"
  };

  const { text, digest } = await fetchText(url, { headers, timeoutMs: 20_000, retries: 2 });
  const repos = parseTrendingHtml(text).map((r) => ({ ...r, repo: unescapeLookalikes(r.repo) }));
  return { repos, snapshot: snapshotOf("github trending 24h", digest, now) };
}
