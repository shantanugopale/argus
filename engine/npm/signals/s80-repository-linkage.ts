import type { NpmScanContext, SignalFinding } from "../../types.ts";
import { DOC_URLS } from "../../types.ts";

export function signalRepositoryLinkage(ctx: NpmScanContext): SignalFinding | null {
  const { npm } = ctx;
  const downloads = npm.downloadsLastWeek ?? 0;
  if (npm.repositoryUrl) return null;
  if (downloads < 10_000) return null;

  return {
    id: "S80",
    title: "No source repository linked",
    points: 10,
    floor: "NEEDS_REVIEW",
    severe: false,
    evidence: `Package pulls ${downloads.toLocaleString("en-US")} weekly downloads but publishes no repository URL — nothing to diff against when the next version ships`,
    refs: [DOC_URLS.S80 ?? ""]
  };
}
