import type { NpmScanContext, SignalFinding } from "../../types.ts";
import { DOC_URLS } from "../../types.ts";
import { nearestTopName } from "../../lib/levenshtein.ts";

export function signalTyposquat(ctx: NpmScanContext): SignalFinding | null {
  const { npm, topNames } = ctx;
  if (topNames.has(npm.name)) return null;

  const near = nearestTopName(npm.name, topNames, 2);
  if (!near) return null;

  if (near.distance === 1) {
    return {
      id: "S60",
      title: "Possible typosquat",
      points: 65,
      floor: "HIGH_RISK",
      severe: true,
      evidence: `Package name is 1 edit away from the top package "${near.name}" — single-character typosquats are the most cited class of install-when-you-meant-something-else attacks`,
      refs: [DOC_URLS.S60 ?? ""]
    };
  }

  return {
    id: "S60",
    title: "Possible snippet-squat",
    points: 40,
    floor: "NEEDS_REVIEW",
    severe: false,
    evidence: `Package name is ${near.distance} edits away from the top package "${near.name}" — verify this is the package you actually meant`,
    refs: [DOC_URLS.S60 ?? ""]
  };
}
