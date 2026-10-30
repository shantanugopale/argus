import type { NpmScanContext, ScanReport, ScanRef, SignalFinding } from "../types.ts";
import { mergeVerdicts } from "../risk/merge.ts";
import { signalKnownVulnerabilities } from "./signals/s10-cve.ts";
import { signalInstallScripts } from "./signals/s20-scripts.ts";
import { signalFreshPublishSpike } from "./signals/s30-fresh-publish.ts";
import { signalSingleMaintainer } from "./signals/s40-single-maintainer.ts";
import { signalTyposquat } from "./signals/s60-typosquat.ts";
import { signalVersionChurn } from "./signals/s70-churn.ts";
import { signalRepositoryLinkage } from "./signals/s80-repository-linkage.ts";
import { signalDegradedProvider } from "./signals/s00-degraded.ts";

type SignalRule = (ctx: NpmScanContext) => SignalFinding | null;

const PIPELINE: readonly SignalRule[] = [
  signalKnownVulnerabilities,
  signalInstallScripts,
  signalFreshPublishSpike,
  signalSingleMaintainer,
  signalTyposquat,
  signalVersionChurn,
  signalRepositoryLinkage
];

export function analyzeNpmPackage(ctx: NpmScanContext): ScanReport {
  const ref: ScanRef = { ecosystem: "npm", name: ctx.npm.name };
  const degraded = ctx.degradedProvider;

  const findings: SignalFinding[] = degraded ? [signalDegradedProvider()] : [];
  for (const rule of PIPELINE) {
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
