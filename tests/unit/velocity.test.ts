import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { analyzeSeries, classifySpike, median, sum } from "../../engine/trend/velocity.ts";

function flatSeries(value: number, days: number): number[] {
  return new Array(days).fill(value);
}

describe("median/sum", () => {
  it("median handles even/odd and empty", () => {
    strictEqual(median([]), 0);
    strictEqual(median([5]), 5);
    strictEqual(median([1, 2, 3, 4]), 2.5);
    strictEqual(median([9, 1, 5]), 5);
  });

  it("sum", () => {
    strictEqual(sum([1, 2, 3]), 6);
  });
});

describe("classifySpike", () => {
  it("absolute floors gate pure ratios", () => {
    strictEqual(classifySpike(100, 10), "none");
    strictEqual(classifySpike(2.5, 600), "rising");
    strictEqual(classifySpike(5, 800), "hot");
    strictEqual(classifySpike(12, 2000), "exploding");
    strictEqual(classifySpike(1.1, 50000), "none");
  });
});

describe("analyzeSeries", () => {
  it("flat series -> none", () => {
    const s = analyzeSeries(flatSeries(1000, 14));
    strictEqual(s.spike, "none");
    ok(s.burstRatio < 1.01);
  });

  it("a real hijack-style burst is exploding", () => {
    const hist = flatSeries(800, 13);
    hist.push(24000);
    const s = analyzeSeries(hist);
    strictEqual(s.spike, "exploding");
    ok(s.burstRatio > 8);
  });

  it("growthPct computed last-7 vs previous-7", () => {
    const hist = [...flatSeries(100, 7), ...flatSeries(300, 7)];
    const s = analyzeSeries(hist);
    strictEqual(s.growthPct, 200);
  });

  it("short series degrades to none, never throws", () => {
    const s = analyzeSeries([42]);
    strictEqual(s.spike, "none");
    const e = analyzeSeries([]);
    strictEqual(e.latest, 0);
  });

  it("zero-baseline burst is exploding, never NaN", () => {
    const hist = [...new Array(13).fill(0), 5000];
    const s = analyzeSeries(hist);
    strictEqual(s.spike, "exploding");
    deepStrictEqual(Number.isFinite(s.burstRatio), true);
  });

  it("slow continuous growth is rising not exploding", () => {
    const hist = Array.from({ length: 14 }, (_, i) => 500 + i * 90);
    const s = analyzeSeries(hist);
    ok(["rising", "hot", "none"].includes(s.spike), `unexpected ${s.spike}`);
    strictEqual(s.spike !== "exploding", true);
  });
});
