import type { RepoScanContext, ScanReport, ScanRef, SignalFinding } from "../types.ts";
import { mergeVerdicts } from "../risk/merge.ts";
import { signalRepoTrustBasics } from "./signals/s90-trust.ts";
import { signalViralNoHistory } from "./signals/s100-viral.ts";
import { signalDepRiskPropagation } from "./signals/s110-deps.ts";

type RepoSignalRule = (ctx: RepoScanContext) => SignalFinding | null;

const REPO_PIPELINE: readonly RepoSignalRule[] = [
  signalRepoTrustBasics,
  signalViralNoHistory,
  signalDepRiskPropagation
];

export function analyzeGithubRepo(ctx: RepoScanContext): ScanReport {
  const ref: ScanRef = { ecosystem: "github", name: ctx.repo.fullName };

  const findings: SignalFinding[] = [];
  for (const rule of REPO_PIPELINE) {
    const finding = rule(ctx);
    if (finding) findings.push(finding);
  }

  const ordered = [...findings].sort((a, b) => a.id.localeCompare(b.id) || a.title.localeCompare(b.title));
  const merged = mergeVerdicts(
    ordered.map((f) => f.points),
    ordered.map((f) => f.floor),
    ordered.map((f) => f.severe)
  );

  return {
    ref,
    verdict: merged.verdict,
    score: merged.score,
    findings: ordered,
    snapshots: [],
    checkedAt: ctx.now
  };
}
