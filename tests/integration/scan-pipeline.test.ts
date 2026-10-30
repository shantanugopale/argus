import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import type { ScanReport } from "../../engine/types.ts";
import { analyzeRef } from "../../engine/analyze-ref.ts";
import { buildFixtureProviders, loadFixtureMeta } from "../../shell/connectors/fixtures.ts";

const FIXTURES_DIR = join(process.cwd(), "tests", "fixtures");

function fixturePackageDirs(): string[] {
  if (!existsSync(FIXTURES_DIR)) return [];
  return readdirSync(FIXTURES_DIR).filter((d) => {
    try {
      return existsSync(join(FIXTURES_DIR, d, "registry.json"));
    } catch {
      return false;
    }
  });
}

const dirs = fixturePackageDirs();

describe("integration: live-protocol fixtures through the full scan pipeline", () => {
  const meta = loadFixtureMeta(FIXTURES_DIR);
  const providers = buildFixtureProviders(FIXTURES_DIR, meta.recordedAt);

  ok(dirs.length >= 5, `expected ≥5 recorded fixtures, found ${dirs.length}`);

  for (const pkg of dirs) {
    it(`scan npm:${pkg} is deterministic and well-shaped`, async () => {
      const report: ScanReport = await analyzeRef({ ecosystem: "npm", name: pkg }, { providers, now: meta.recordedAt });
      const again = await analyzeRef({ ecosystem: "npm", name: pkg }, { providers, now: meta.recordedAt });

      strictEqual(JSON.stringify(report), JSON.stringify(again), "differs across runs");
      deepStrictEqual(report.ref, { ecosystem: "npm", name: pkg });
      ok(Array.isArray(report.findings));
      ok(report.score >= 0 && report.score <= 100);

      const ids = report.findings.map((f) => f.id);
      deepStrictEqual(ids, [...ids].sort(), "findings not id-ordered");

      if (report.verdict === "CRITICAL" || report.verdict === "HIGH_RISK") {
        ok(report.findings.some((f) => f.severe), "severe verdict without any severe finding");
      }
    });
  }

  it("known hijack-history fixture event-stream still scans without network", async () => {
    if (!dirs.includes("event-stream")) return;
    const report = await analyzeRef({ ecosystem: "npm", name: "event-stream" }, { providers, now: meta.recordedAt });
    ok(report.findings.every((f) => f.points >= 0));
  });

  it("popular fixture package names never self-typosquat", async () => {
    for (const pkg of ["chalk", "lodash", "express", "react"]) {
      if (!dirs.includes(pkg)) continue;
      const report = await analyzeRef({ ecosystem: "npm", name: pkg }, { providers, now: meta.recordedAt });
      strictEqual(
        report.findings.some((f) => f.id === "S60"),
        false,
        `${pkg} must not flag itself as typosquat`
      );
    }
  });
});
