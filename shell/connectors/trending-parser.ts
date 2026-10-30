export interface TrendingRepo {
  repo: string;
  starsThisPeriod: number;
  period: "day" | "week" | "month";
}

const NON_REPO_SEGMENTS = new Set<string>([
  "sponsors",
  "orgs",
  "features",
  "about",
  "pricing",
  "security",
  "explore",
  "marketplace",
  "enterprise",
  "collections",
  "topics",
  "site",
  "readme",
  "settings",
  "notifications"
]);

function isRepoPath(repo: string): boolean {
  const first = repo.split("/")[0] ?? "";
  return first.length > 0 && !NON_REPO_SEGMENTS.has(first);
}

export function parseTrendingHtml(html: string): TrendingRepo[] {
  const out: TrendingRepo[] = [];
  const articleRe = /<article[\s>][\s\S]*?<\/article>/g;
  const repoRe = /href="\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\/stargazers)?"[^>]*>/;
  const starsRe = /([\d,]+)\s*stars\s*(?:today|this\s*(day|week|month))/i;

  const articles = html.match(articleRe) ?? [];
  for (const article of articles) {
    const repoMatch = repoRe.exec(article);
    if (!repoMatch?.[1]) continue;
    const repo = repoMatch[1];
    if (!isRepoPath(repo)) continue;
    if (out.some((r) => r.repo === repo)) continue;

    const starsMatch = starsRe.exec(article);
    const stars = starsMatch?.[1] ? Number.parseInt(starsMatch[1].replace(/,/g, ""), 10) : 0;
    const period = (starsMatch?.[2] ?? "day") as TrendingRepo["period"];
    if (!Number.isFinite(stars)) continue;
    out.push({ repo, starsThisPeriod: stars, period });
  }
  return out;
}
