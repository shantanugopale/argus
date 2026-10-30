import type { NpmScanContext, SignalFinding } from "../../types.ts";
import { DOC_URLS } from "../../types.ts";

const HOUR_MS = 3_600_000;

function ageHours(publishedAt: string, now: string): number | null {
  const t = Date.parse(publishedAt);
  const n = Date.parse(now);
  if (Number.isNaN(t) || Number.isNaN(n)) return null;
  return (n - t) / HOUR_MS;
}

export function signalFreshPublishSpike(ctx: NpmScanContext): SignalFinding | null {
  const { npm } = ctx;
  if (!npm.latestPublishedAt) return null;

  const age = ageHours(npm.latestPublishedAt, ctx.now);
  if (age === null) return null;
  if (age < 0) return null;

  const downloads = npm.downloadsLastWeek ?? 0;
  const fresh = age <= 24;
  const recent = age <= 72;
  const popular = downloads >= 10_000;
  const hasTraffic = downloads >= 500;

  if (fresh && popular) {
    return {
      id: "S30",
      title: "Fresh publish, hot traffic",
      points: 45,
      floor: "HIGH_RISK",
      severe: true,
      evidence: `Latest version ${npm.latest} published ${age.toFixed(1)}h ago while pulling ${downloads.toLocaleString("en-US")} downloads/week — >10k/wk traffic on a <24h-old version is the classic fresh-hijack / slopsquat pattern`,
      refs: [DOC_URLS.S30 ?? ""]
    };
  }
  if (fresh && hasTraffic) {
    return {
      id: "S30",
      title: "Freshly published version with traffic",
      points: 25,
      floor: "NEEDS_REVIEW",
      severe: false,
      evidence: `Latest version ${npm.latest} published ${age.toFixed(1)}h ago (${downloads.toLocaleString("en-US")} downloads/week)`,
      refs: [DOC_URLS.S30 ?? ""]
    };
  }
  if (recent && popular) {
    return {
      id: "S30",
      title: "Hot traffic on recent publish",
      points: 20,
      floor: "NEEDS_REVIEW",
      severe: false,
      evidence: `Latest version ${npm.latest} published ${age.toFixed(1)}h ago (${downloads.toLocaleString("en-US")} downloads/week)`,
      refs: [DOC_URLS.S30 ?? ""]
    };
  }
  return null;
}
