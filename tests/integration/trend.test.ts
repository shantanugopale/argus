import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { buildTrendReport, type TrendingRepoRow } from "../../engine/trend/build-trend.ts";
import { analyzeSeries } from "../../engine/trend/velocity.ts";
import { parseTrendingHtml } from "../../shell/connectors/trending-parser.ts";
import { parseRangeResponse } from "../../shell/connectors/range-parser.ts";

const SAMPLE_TRENDING_HTML = `
<html><body>
<article class="Box-row">
  <h2><a href="/some-org/some-viral-repo" data-view-component="true">some-viral-repo</a></h2>
  <span class="d-inline-block float-sm-right">2,340 stars today</span>
</article>
<article class="Box-row">
  <h2><a href="/other/brainrot" data-view-component="true">brainrot</a></h2>
  <span>about 120 stars this week</span>
</article>
<article class="Box-row">
  <h2><a href="/dup/dup">dup</a></h2>
  <span>about 10 stars today</span>
</article>
<article class="Box-row">
  <h2><a href="/dup/dup">dup</a></h2>
  <span>about 10 stars today</span>
</article>
</body></html>`;

describe("parseTrendingHtml", () => {
  it("parses repo + daily stars with realistic markup", () => {
    const rows = parseTrendingHtml(SAMPLE_TRENDING_HTML);
    ok(rows.length >= 3, `expected >=3, got ${rows.length}`);
    const first = rows.find((r) => r.repo === "some-org/some-viral-repo");
    ok(first, "viral repo missing");
    strictEqual(first.starsThisPeriod, 2340);
    strictEqual(first.period, "day");
  });

  it("deduplicates repeated articles", () => {
    const rows = parseTrendingHtml(SAMPLE_TRENDING_HTML);
    const dupRows = rows.filter((r) => r.repo === "dup/dup");
    strictEqual(dupRows.length, 1);
  });

  it("week period parsed", () => {
    const rows = parseTrendingHtml(SAMPLE_TRENDING_HTML);
    const week = rows.find((r) => r.repo === "other/brainrot");
    ok(week);
    strictEqual(week.period, "week");
  });

  it("empty html yields empty list", () => {
    deepStrictEqual(parseTrendingHtml(""), []);
    deepStrictEqual(parseTrendingHtml("<html><body>nothing</body></html>"), []);
  });

  it("sponsor overlay links are not reported as repos", () => {
    const html = `<article class="Box-row">
      <h2><a href="/real/owner-repo">owner-repo</a></h2>
      <a href="/sponsors/stealing-worker"><img alt="@stealing-worker" /></a>
      <span>400 stars today</span>
    </article>`;
    const rows = parseTrendingHtml(html);
    deepStrictEqual(rows.map((r) => r.repo), ["real/owner-repo"]);
  });
});

describe("parseRangeResponse", () => {
  it("fills holes with zeros and returns ascending series", () => {
    const series = parseRangeResponse(
      {
        start: "2026-10-10",
        end: "2026-10-13",
        downloads: [
          { day: "2026-10-10", downloads: 10 },
          { day: "2026-10-12", downloads: 30 }
        ]
      },
      4
    );
    deepStrictEqual(series, [10, 0, 30, 0]);
  });

  it("empty response yields zero series of window length", () => {
    const series = parseRangeResponse({ downloads: [] }, 5);
    ok(series.length > 0);
    deepStrictEqual(series, new Array(series.length).fill(0));
  });
});

describe("buildTrendReport", () => {
  it("ranks exploding > hot > rising > none", () => {
    const seriesByName = new Map<string, number[]>([
      ["calm-a", [...new Array(14).fill(900)]],
      ["brurst-b", [...new Array(13).fill(500), 9000]],
      ["warm-c", [...new Array(13).fill(300), 1300]],
      ["cool-d", [500, 520, 505, 530, 610, 640, 700, 760, 810, 880, 960, 1040, 1150, 1260]]
    ]);
    const repos: TrendingRepoRow[] = [
      { repo: "a/b", starsThisPeriod: 10, period: "day" },
      { repo: "c/d", starsThisPeriod: 900, period: "day" }
    ];
    const report = buildTrendReport({
      generatedAt: "2026-10-28T00:00:00.000Z",
      windowDays: 14,
      seriesByName,
      repos
    });

    ok(report.rows.length >= 2, `rows: ${JSON.stringify(report.rows)}`);
    const spikes = report.rows.map((r) => r.spike);
    const firstNonNone = spikes.findIndex((s) => s !== "none");
    ok(firstNonNone >= 0);
    const order = { exploding: 3, hot: 2, rising: 1, none: 0 } as Record<string, number>;
    for (let i = 1; i < spikes.length; i++) {
      const prev = order[spikes[i - 1] ?? "none"] ?? 0;
      const curr = order[spikes[i] ?? "none"] ?? 0;
      ok(curr <= prev, `rank violated at ${i}: ${JSON.stringify(spikes)}`);
    }
    strictEqual(report.repos[0]?.repo, "c/d");
  });

  it("all-zero series are dropped from rows", () => {
    const report = buildTrendReport({
      generatedAt: "t",
      windowDays: 14,
      seriesByName: new Map([["ghost", new Array(14).fill(0)]]),
      repos: []
    });
    deepStrictEqual(report.rows, []);
  });

  it("cohort-wide systemic shifts normalize into relativeRatio", () => {
    const systemic: number[][] = [];
    for (let i = 0; i < 6; i++) {
      systemic.push([...new Array(9).fill(1000), 3000]);
    }
    const outlier = [...new Array(9).fill(2000), 40000];

    const seriesByName = new Map<string, number[]>([
      ["s1", systemic[0] ?? []],
      ["s2", systemic[1] ?? []],
      ["s3", systemic[2] ?? []],
      ["s4", systemic[3] ?? []],
      ["s5", systemic[4] ?? []],
      ["s6", systemic[5] ?? []],
      ["outlier", outlier]
    ]);
    const report = buildTrendReport({
      generatedAt: "2026-10-28T00:00:00.000Z",
      windowDays: 10,
      seriesByName,
      repos: []
    });

    const outlierRow = report.rows.find((r) => r.name === "outlier");
    const systemicRow = report.rows.find((r) => r.name === "s1");
    ok(outlierRow, "outlier missing");
    ok(systemicRow, "systemic row missing");
    deepStrictEqual(report.rows[0]?.name, "outlier");
    strictEqual(outlierRow.cohortWide, true);
    ok(outlierRow.relativeRatio > systemicRow.burstRatio);
  });

  it("analyzeSeries keeps output stable", () => {
    const a = analyzeSeries([1, 2, 3, 4]);
    const b = analyzeSeries([1, 2, 3, 4]);
    deepStrictEqual(JSON.stringify(a), JSON.stringify(b));
  });
});
