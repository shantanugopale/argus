import type { NpmScanContext, OsSeverity, OsVuln, SignalFinding, VerdictClass } from "../../types.ts";
import { DOC_URLS } from "../../types.ts";

export function signalKnownVulnerabilities(ctx: NpmScanContext): SignalFinding | null {
  const { vulns } = ctx.advisories;
  if (vulns.length === 0) return null;

  const rank: Record<OsSeverity, number> = { LOW: 0, MODERATE: 1, HIGH: 2, CRITICAL: 3 };
  const worst: OsVuln | undefined = [...vulns].sort((a, b) => rank[b.severity] - rank[a.severity])[0];
  if (!worst) return null;

  const pointsBySeverity: Record<OsSeverity, number> = { LOW: 15, MODERATE: 30, HIGH: 55, CRITICAL: 80 };
  const floorBySeverity: Record<OsSeverity, VerdictClass> = { LOW: "NEEDS_REVIEW", MODERATE: "NEEDS_REVIEW", HIGH: "HIGH_RISK", CRITICAL: "CRITICAL" };

  const ids = vulns.map((v) => v.id).slice(0, 5).join(", ");
  const extra = vulns.length > 5 ? ` (+${vulns.length - 5} more)` : "";

  return {
    id: "S10",
    title: "Known vulnerabilities",
    points: pointsBySeverity[worst.severity],
    floor: floorBySeverity[worst.severity],
    severe: worst.severity === "HIGH" || worst.severity === "CRITICAL",
    evidence: `OSV.dev lists ${vulns.length} advisor${vulns.length === 1 ? "y" : "ies"} for this package; worst severity ${worst.severity}: ${ids}${extra}`,
    refs: [DOC_URLS.S10 ?? "https://osv.dev", ...vulns.map((v) => v.refs[0]).filter((r): r is string => typeof r === "string").filter(Boolean)].filter(Boolean)
  };
}
