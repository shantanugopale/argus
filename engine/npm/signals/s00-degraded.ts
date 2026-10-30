import type { SignalFinding } from "../../types.ts";
import { DOC_URLS } from "../../types.ts";

export function signalDegradedProvider(): SignalFinding {
  return {
    id: "S00",
    title: "Advisory feed unavailable",
    points: 15,
    floor: "NEEDS_REVIEW",
    severe: false,
    evidence: "Could not reach the vulnerability advisory provider during this scan — no-patches noticed does NOT mean no vulnerabilities; re-scan later for full coverage",
    refs: [DOC_URLS.S00 ?? ""]
  };
}
