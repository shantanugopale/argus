import type { NpmScanContext, SignalFinding } from "../../types.ts";
import { DOC_URLS } from "../../types.ts";

const HOUR_MS = 3_600_000;

export function signalVersionChurn(ctx: NpmScanContext): SignalFinding | null {
  const now = Date.parse(ctx.now);
  if (Number.isNaN(now)) return null;

  let churnCount = 0;
  for (const [key, iso] of Object.entries(ctx.npm.time)) {
    if (key === "created" || key === "modified") continue;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) continue;
    if (now - t <= 24 * HOUR_MS && now - t >= 0) churnCount++;
  }
  if (churnCount < 8) return null;

  return {
    id: "S70",
    title: "Version churn burst",
    points: 30,
    floor: "NEEDS_REVIEW",
    severe: false,
    evidence: `${churnCount} versions pushed in the last 24h — bursts are a fast way for a bad actor to slip unspeakable changes past subscriber review`,
    refs: [DOC_URLS.S70 ?? ""]
  };
}
