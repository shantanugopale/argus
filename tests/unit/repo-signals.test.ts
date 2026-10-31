import { ok, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import type { RepoScanContext, ScanReport } from "../../engine/types.ts";
import { analyzeGithubRepo } from "../../engine/repo/analyze.ts";

const NOW = "2026-10-28T00:00:00.000Z";

function baseRepo(overrides: Record<string, unknown> = {}): RepoScanContext["repo"] {
  return {
    fullName: "owner/repo",
    stars: 1200,
    forks: 40,
    openIssues: 5,
    licenseSpdx: "MIT",
    description: "a sturdy little repo",
    createdAt: "2020-01-01T00:00:00.000Z",
    pushedAt: "2026-10-27T00:00:00.000Z",
    topics: [],
    ownerType: "Organization",
    archived: false,
    manifest: null,
    ...overrides
  } as RepoScanContext["repo"];
}

function baseCtx(overrides: Partial<RepoScanContext> = {}): RepoScanContext {
  return {
    repo: baseRepo(),
    trendingStarsToday: null,
    trendingAvailable: true,
    depReports: [],
    depsScanned: [],
    now: NOW,
    ...overrides
  };
}

describe("S90 repo trust basics", () => {
  it("license+description present -> no finding", () => {
    const r = analyzeGithubRepo(baseCtx());
    strictEqual(r.findings.some((f) => f.id === "S90"), false);
  });

  it("no license only -> NEEDS_REVIEW floor", () => {
    const r = analyzeGithubRepo(baseCtx({ repo: baseRepo({ licenseSpdx: null }) }));
    const f = r.findings.find((x) => x.id === "S90");
    ok(f);
    strictEqual(f.floor, "NEEDS_REVIEW");
    strictEqual(r.verdict, "NEEDS_REVIEW");
  });

  it("no license and no description -> higher points", () => {
    const r = analyzeGithubRepo(baseCtx({ repo: baseRepo({ licenseSpdx: null, description: "" }) }));
    const f = r.findings.find((x) => x.id === "S90");
    ok(f);
    strictEqual(f.points, 15);
  });
});

describe("S100 viral-no-history", () => {
  it("no trending row -> no finding", () => {
    const r = analyzeGithubRepo(baseCtx());
    strictEqual(r.findings.some((f) => f.id === "S100"), false);
  });

  it("young + hot -> HIGH_RISK floor", () => {
    const r = analyzeGithubRepo(baseCtx({
      repo: baseRepo({ createdAt: "2026-08-01T00:00:00.000Z" }),
      trendingStarsToday: 1200
    }));
    const f = r.findings.find((x) => x.id === "S100");
    ok(f);
    strictEqual(f.floor, "HIGH_RISK");
    strictEqual(r.verdict, "HIGH_RISK");
    strictEqual(f.severe, true);
  });

  it("old + hot -> NEEDS_REVIEW", () => {
    const r = analyzeGithubRepo(baseCtx({ trendingStarsToday: 1200 }));
    const f = r.findings.find((x) => x.id === "S100");
    ok(f);
    strictEqual(f.floor, "NEEDS_REVIEW");
  });

  it("young + moderate attention -> NEEDS_REVIEW", () => {
    const r = analyzeGithubRepo(baseCtx({
      repo: baseRepo({ createdAt: "2026-08-01T00:00:00.000Z" }),
      trendingStarsToday: 400
    }));
    const f = r.findings.find((x) => x.id === "S100");
    ok(f);
    strictEqual(f.floor, "NEEDS_REVIEW");
  });

  it("trending row below absolute gate -> ignored", () => {
    const r = analyzeGithubRepo(baseCtx({ trendingStarsToday: 150 }));
    strictEqual(r.findings.some((f) => f.id === "S100"), false);
  });
});

describe("S110 dep risk propagation", () => {
  it("no deps -> no finding", () => {
    const r = analyzeGithubRepo(baseCtx());
    strictEqual(r.findings.some((f) => f.id === "S110"), false);
  });

  it("a HIGH_RISK dep propagates severity with names in evidence", () => {
    const depReport: ScanReport = {
      ref: { ecosystem: "npm", name: "sneaky-pkg" },
      verdict: "HIGH_RISK",
      score: 60,
      findings: [{ id: "S20", title: "scripts", points: 60, severe: true, floor: "HIGH_RISK" as const, evidence: "x" }],
      snapshots: [],
      checkedAt: NOW
    };
    const r = analyzeGithubRepo(baseCtx({ depReports: [depReport], depsScanned: ["sneaky-pkg"] }));
    const f = r.findings.find((x) => x.id === "S110");
    ok(f);
    strictEqual(f.floor, "HIGH_RISK");
    ok(f.evidence.includes("sneaky-pkg"));
  });

  it("NEEDS_REVIEW deps stay below HIGH_RISK", () => {
    const depReport: ScanReport = {
      ref: { ecosystem: "npm", name: "mid-pkg" },
      verdict: "NEEDS_REVIEW",
      score: 20,
      findings: [],
      snapshots: [],
      checkedAt: NOW
    };
    const r = analyzeGithubRepo(baseCtx({ depReports: [depReport], depsScanned: ["mid-pkg"] }));
    strictEqual(r.verdict, "NEEDS_REVIEW");
  });
});

describe("repo analyzer pipeline", () => {
  it("findings deterministic and id-ordered", () => {
    const a = analyzeGithubRepo(baseCtx({ trendingStarsToday: 500 }));
    const b = analyzeGithubRepo(baseCtx({ trendingStarsToday: 500 }));
    strictEqual(JSON.stringify(a), JSON.stringify(b));
    const ids = a.findings.map((f) => f.id);
    ok(ids.every((id, i) => i === 0 || (ids[i - 1] ?? "") <= id));
  });

  it("clean repo verdict SAFE", () => {
    const r = analyzeGithubRepo(baseCtx());
    strictEqual(r.verdict, "SAFE");
    strictEqual(r.score, 0);
  });
});
