import type { VerdictClass } from "../types.ts";

const ORDER: readonly VerdictClass[] = ["SAFE", "NEEDS_REVIEW", "HIGH_RISK", "CRITICAL"];

function indexOf(v: VerdictClass): number {
  return ORDER.indexOf(v);
}

export function maxVerdict(a: VerdictClass, b: VerdictClass): VerdictClass {
  return indexOf(a) >= indexOf(b) ? a : b;
}

export function verdictForScore(score: number): VerdictClass {
  if (score >= 70) return "CRITICAL";
  if (score >= 40) return "HIGH_RISK";
  if (score >= 15) return "NEEDS_REVIEW";
  return "SAFE";
}

export interface MergedVerdict {
  verdict: VerdictClass;
  score: number;
}

const SEVERE_CAP_SCORE = 39;

export function mergeVerdicts(
  points: number[],
  floors: ReadonlyArray<VerdictClass | undefined>,
  severeFlags: ReadonlyArray<boolean> = []
): MergedVerdict {
  const clamped = Math.min(100, Math.max(0, Math.round(points.reduce((a, b) => a + b, 0))));
  const hasSevere = severeFlags.some(Boolean);
  const effectiveScore = hasSevere ? clamped : Math.min(clamped, SEVERE_CAP_SCORE);

  let scored = verdictForScore(effectiveScore);
  let floored: VerdictClass | undefined;
  for (const f of floors) {
    if (f && (!floored || indexOf(f) > indexOf(floored))) floored = f;
  }
  if (floored) scored = maxVerdict(scored, floored);
  return { verdict: scored, score: clamped };
}
