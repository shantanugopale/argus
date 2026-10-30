import { ok, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { maxVerdict, mergeVerdicts, verdictForScore } from "../../engine/risk/merge.ts";
import type { VerdictClass } from "../../engine/types.ts";

describe("verdictForScore", () => {
  it("maps thresholds deterministically", () => {
    strictEqual(verdictForScore(0), "SAFE");
    strictEqual(verdictForScore(14), "SAFE");
    strictEqual(verdictForScore(15), "NEEDS_REVIEW");
    strictEqual(verdictForScore(39), "NEEDS_REVIEW");
    strictEqual(verdictForScore(40), "HIGH_RISK");
    strictEqual(verdictForScore(69), "HIGH_RISK");
    strictEqual(verdictForScore(70), "CRITICAL");
    strictEqual(verdictForScore(100), "CRITICAL");
  });
});

describe("mergeVerdicts", () => {
  it("sums points and clamps at 100", () => {
    const out = mergeVerdicts([60, 60], []);
    strictEqual(out.score, 100);
  });

  it("floor upgrades verdict even when points are low", () => {
    const floors: ReadonlyArray<VerdictClass | undefined> = ["CRITICAL"];
    const out = mergeVerdicts([5], floors);
    strictEqual(out.verdict, "CRITICAL");
    strictEqual(out.score, 5);
  });

  it("ignores undefined floors", () => {
    const out = mergeVerdicts([5, 5], [undefined, undefined]);
    strictEqual(out.verdict, "SAFE");
  });

  it("score can be lower than floor implies — verdict obeys floor", () => {
    const out = mergeVerdicts([20], ["HIGH_RISK", undefined] as ReadonlyArray<VerdictClass | undefined>);
    strictEqual(out.verdict, "HIGH_RISK");
  });
});

describe("maxVerdict", () => {
  it("orders correctly", () => {
    strictEqual(maxVerdict("SAFE", "HIGH_RISK"), "HIGH_RISK");
    strictEqual(maxVerdict("CRITICAL", "NEEDS_REVIEW"), "CRITICAL");
    strictEqual(maxVerdict("SAFE", "SAFE"), "SAFE");
  });
});

describe("invariants", () => {
  it("ordered permutation yields same score", () => {
    const a = mergeVerdicts([25, 45], [undefined, undefined]);
    const b = mergeVerdicts([45, 25], [undefined, undefined]);
    strictEqual(a.score, b.score);
  });
  ok(true);
});
