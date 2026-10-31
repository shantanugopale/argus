import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { analyzeRef } from "../../engine/analyze-ref.ts";
import { buildFixtureProviders, loadFixtureMeta } from "../../shell/connectors/fixtures.ts";
import { parseRef } from "../../shell/parse-ref.ts";
import type { ScanReport } from "../../engine/types.ts";

const FIXTURES_DIR = "tests/fixtures";
const FIXED_NOW = "2026-10-31T05:30:00.000Z";

const GOLDEN: ReadonlyArray<readonly [string, string, number]> = [
  ["npm:chalk", "NEEDS_REVIEW", 50],
  ["npm:debug", "HIGH_RISK", 55],
  ["npm:lodash", "CRITICAL", 100],
  ["npm:react", "HIGH_RISK", 55],
  ["npm:request", "NEEDS_REVIEW", 30],
  ["npm:colors", "CRITICAL", 75],
  ["npm:left-pad", "SAFE", 0],
  ["npm:event-stream", "CRITICAL", 100],
  ["npm:express", "NEEDS_REVIEW", 30],
  ["npm:semver", "HIGH_RISK", 55],
  ["npm:axios", "CRITICAL", 100],
  ["npm:node-fetch", "HIGH_RISK", 55],
  ["gh:facebook/react", "SAFE", 0],
  ["gh:expressjs/express", "SAFE", 0]
];

const KNOWN_ANCHORS: ReadonlyArray<readonly [string, string]> = [
  ["npm:chalk", "MAL-2025-46969"],
  ["npm:lodash", "GHSA-29mw-wpgm-hmr9"]
];

function hasEvidence(report: ScanReport, needle: string): boolean {
  return report.findings.some((f) => `${f.evidence} ${f.title}`.includes(needle));
}

describe("golden corpus regression", () => {
  const meta = loadFixtureMeta(FIXTURES_DIR);
  const providers = buildFixtureProviders(FIXTURES_DIR, meta.recordedAt);

  it("verdicts + scores stable across the whole corpus", async () => {
    for (const [refName, verdict, score] of GOLDEN) {
      const report = await analyzeRef(parseRef(refName), { providers, now: FIXED_NOW });
      if (report.verdict !== verdict || report.score !== score) {
        throw new Error(`golden drift on ${refName}: got ${report.verdict}/${report.score}, expected ${verdict}/${score}`);
      }
    }
  });

  it("known evidence anchors still present", async () => {
    for (const [refName, needle] of KNOWN_ANCHORS) {
      const report = await analyzeRef(parseRef(refName), { providers, now: FIXED_NOW });
      strictEqual(hasEvidence(report, needle), true, `${refName} missing anchor ${needle}`);
    }
  });
});
