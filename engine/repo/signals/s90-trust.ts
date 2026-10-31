import type { RepoScanContext, SignalFinding } from "../../types.ts";
import { DOC_URLS } from "../../types.ts";

export function signalRepoTrustBasics(ctx: RepoScanContext): SignalFinding | null {
  const { repo } = ctx;
  const missing: string[] = [];

  if (!repo.licenseSpdx) missing.push("license");
  if (!repo.description || repo.description.trim().length === 0) missing.push("description");
  if (missing.length === 0) return null;

  const points = missing.length === 2 ? 15 : 6;
  return {
    id: "S90",
    title: "Repo trust basics missing",
    points,
    floor: "NEEDS_REVIEW",
    severe: false,
    evidence: `${repo.fullName} does not publish ${missing.join(" and ")} — baseline hygiene signals absent, minimal due diligence is on you`,
    refs: [DOC_URLS.S90 ?? ""]
  };
}
