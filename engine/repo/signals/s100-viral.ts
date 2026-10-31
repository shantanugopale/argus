import type { RepoScanContext, SignalFinding } from "../../types.ts";
import { DOC_URLS } from "../../types.ts";

const DAY_MS = 86_400_000;

export function signalViralNoHistory(ctx: RepoScanContext): SignalFinding | null {
  const { repo } = ctx;
  if (ctx.trendingStarsToday === null) return null;
  if (ctx.trendingStarsToday < 200) return null;

  const created = Date.parse(repo.createdAt);
  const now = Date.parse(ctx.now);
  if (Number.isNaN(created) || Number.isNaN(now)) return null;
  const ageDays = (now - created) / DAY_MS;

  const hot = ctx.trendingStarsToday >= 1000;
  const young = ageDays <= 180;

  if (hot && young) {
    return {
      id: "S100",
      title: "Viral repo with shallow history",
      points: 40,
      floor: "HIGH_RISK",
      severe: true,
      evidence: `${repo.fullName} is ${ageDays.toFixed(0)} days old and currently pulling ${ctx.trendingStarsToday} stars today — bait-then-strike and star-recycling campaigns live exactly in this regime`,
      refs: [DOC_URLS.S100 ?? ""]
    };
  }
  if (hot) {
    return {
      id: "S100",
      title: "Hard-spiking trending repo",
      points: 25,
      floor: "NEEDS_REVIEW",
      severe: false,
      evidence: `${repo.fullName} is pulling ${ctx.trendingStarsToday} stars today (${ageDays.toFixed(0)} days old) — verify this is the project you actually meant`,
      refs: [DOC_URLS.S100 ?? ""]
    };
  }
  if (young) {
    return {
      id: "S100",
      title: "Young repo with trending attention",
      points: 10,
      floor: "NEEDS_REVIEW",
      severe: false,
      evidence: `${repo.fullName} is ${ageDays.toFixed(0)} days old with ${ctx.trendingStarsToday} stars today`,
      refs: [DOC_URLS.S100 ?? ""]
    };
  }
  return null;
}
