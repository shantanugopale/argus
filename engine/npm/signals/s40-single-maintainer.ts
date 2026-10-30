import type { NpmScanContext, SignalFinding } from "../../types.ts";
import { DOC_URLS } from "../../types.ts";

export function signalSingleMaintainer(ctx: NpmScanContext): SignalFinding | null {
  const { npm } = ctx;
  const downloads = npm.downloadsLastWeek ?? 0;
  if (npm.maintainers.length >= 2) return null;
  if (downloads < 50_000) return null;

  const owner = npm.maintainers[0]?.name ?? "unknown";
  return {
    id: "S40",
    title: "Bus-factor one",
    points: 20,
    floor: "NEEDS_REVIEW",
    severe: false,
    evidence: `Only ${npm.maintainers.length === 0 ? "no listed" : `one`} maintainer (${owner}) for a package with ${downloads.toLocaleString("en-US")} weekly downloads — compromise of a single account redirects every consumer`,
    refs: [DOC_URLS.S40 ?? ""]
  };
}
