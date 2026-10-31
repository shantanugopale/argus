import type { RepoScanContext, SignalFinding } from "../../types.ts";
import { DOC_URLS } from "../../types.ts";

export function signalDepRiskPropagation(ctx: RepoScanContext): SignalFinding | null {
  if (ctx.depReports.length === 0) return null;

  const worst = [...ctx.depReports].sort((a, b) => b.score - a.score)[0];
  if (!worst) return null;

  if (worst.verdict === "CRITICAL" || worst.verdict === "HIGH_RISK") {
    const badDeps = ctx.depReports.filter((r) => r.verdict === "CRITICAL" || r.verdict === "HIGH_RISK").map((r) => r.ref.name);
    return {
      id: "S110",
      title: "Risky dependencies propagate",
      points: 55,
      floor: worst.verdict,
      severe: true,
      evidence: `Installing this repo means installing these dependencies too — ${badDeps.join(", ")} scans at ${worst.verdict} (worst signal ids: ${worst.findings.map((f) => f.id).join(", ") || "none"})`,
      refs: [DOC_URLS.S110 ?? ""]
    };
  }

  if (worst.verdict === "NEEDS_REVIEW") {
    const flagged = ctx.depReports.filter((r) => r.verdict !== "SAFE").map((r) => `${r.ref.name} (+${r.score})`);
    return {
      id: "S110",
      title: "Dependencies flag NEEDS_REVIEW",
      points: 10,
      floor: "NEEDS_REVIEW",
      severe: false,
      evidence: `Dependency signals present: ${flagged.join(" | ")}`,
      refs: [DOC_URLS.S110 ?? ""]
    };
  }

  return null;
}
