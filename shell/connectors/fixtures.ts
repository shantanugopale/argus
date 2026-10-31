import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OsAdvisories, ProviderSnapshot, ScanProviders } from "../../engine/types.ts";
import { parseNpmPackageData, PackageNotFoundError } from "./npm-registry.ts";
import { parseOsvResponse } from "./osv-dev.ts";
import { snapshotOf, type HttpResult } from "./http.ts";
import { parseTrendingHtml, unescapeLookalikes } from "./github-trending.ts";
import { parseGithubRepoDoc, parseRepoManifest } from "../../engine/lib/parse-repo.ts";

export interface FixtureMeta {
  recordedAt: string;
  packages: string[];
}

export function loadFixtureMeta(fixturesDir: string): FixtureMeta {
  const raw = readFileSync(join(fixturesDir, "meta.json"), "utf8");
  return JSON.parse(raw) as FixtureMeta;
}

export function readFixture(fixturesDir: string, relPath: string): HttpResult {
  const raw = readFileSync(join(fixturesDir, relPath), "utf8");
  return { json: JSON.parse(raw) as unknown, digest: snapshotDigest(raw) };
}

export function buildFixtureProviders(fixturesDir: string, now: string): ScanProviders {
  return {
    async getNpmPackage(name) {
      const base = fixtureBase(name);
      const registry = readFixtureSafe(fixturesDir, join(base, "registry.json"), name);
      let week: HttpResult | null = null;
      let month: HttpResult | null = null;
      try {
        week = readFixture(fixturesDir, join(base, "downloads-week.json"));
      } catch {}
      try {
        month = readFixture(fixturesDir, join(base, "downloads-month.json"));
      } catch {}

      const snapshot: ProviderSnapshot = snapshotOf(`fixture://registry/${base}`, registry.digest, now);
      return {
        data: parseNpmPackageData(name, registry.json, week?.json ?? null, month?.json ?? null),
        snapshot
      };
    },
    async getAdvisories(name) {
      const base = fixtureBase(name);
      const osv = readFixture(fixturesDir, join(base, "osv.json"));
      const data: OsAdvisories = parseOsvResponse(osv.json);
      return { data, snapshot: snapshotOf(`fixture://osv/${base}`, osv.digest, now) };
    },
    async getGithubRepo(fullName) {
      const base = fullName.replace(/\/+/g, "__");
      const repo = readFixtureSafe(fixturesDir, join("gh", `${base}.json`), fullName);
      const snapshot = snapshotOf(`fixture://github/${base}`, repo.digest, now);
      const manifestText = readTextFixture(fixturesDir, join("gh", `${base}.package.json`));
      const manifest = manifestText === null ? null : parseRepoManifest(JSON.parse(manifestText));
      return {
        data: parseGithubRepoDoc(repo.json, manifest, fullName),
        snapshot
      };
    },
    async getTrendingToday() {
      const html = readTextFixture(fixturesDir, join("gh", "trending.html")) ?? "";
      const repos = parseTrendingHtml(html)
        .map((r) => ({ repo: unescapeLookalikes(r.repo), starsThisPeriod: r.starsThisPeriod, period: r.period }));
      const snapshot = snapshotOf("fixture://github-trending", String(html.length), now);
      return { repos, snapshot };
    }
  };
}

function readTextFixture(fixturesDir: string, relPath: string): string | null {
  try {
    return readFileSync(join(fixturesDir, relPath), "utf8");
  } catch {
    return null;
  }
}

function readFixtureSafe(fixturesDir: string, relPath: string, pkgName: string): HttpResult {
  try {
    return readFixture(fixturesDir, relPath);
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as NodeJS.ErrnoException).code === "ENOENT") {
      throw new PackageNotFoundError(pkgName);
    }
    throw e;
  }
}

function fixtureBase(name: string): string {
  return name.replace(/[^a-z0-9@._-]/gi, "_");
}

function snapshotDigest(raw: string): string {
  return raw.length.toString(16).padStart(4, "0");
}
