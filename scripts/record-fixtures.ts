import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseNpmPackageData } from "../shell/connectors/npm-registry.ts";
import { parseOsvResponse } from "../shell/connectors/osv-dev.ts";

const FIXTURES_DIR = join(process.cwd(), "tests", "fixtures");

const PACKAGES: string[] = [
  "chalk",
  "debug",
  "lodash",
  "react",
  "request",
  "colors",
  "left-pad",
  "event-stream",
  "express",
  "semver",
  "axios",
  "node-fetch"
];

async function withRetry<T>(fn: () => Promise<T>, attempts = 4, baseDelayMs = 1500): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
    }
  }
  throw lastError;
}

async function recordOne(rawName: string): Promise<string> {
  const safe = safeName(rawName);
  const dir = join(FIXTURES_DIR, safe);
  mkdirSync(dir, { recursive: true });

  const regRes = await withRetry(async () => {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(rawName)}`);
    if (res.status !== 200) throw new Error(`registry HTTP ${res.status} for ${rawName}`);
    return res;
  });
  writeFileSync(join(dir, "registry.json"), await regRes.text());

  for (const [period, file] of [
    ["last-week", "downloads-week.json"],
    ["last-month", "downloads-month.json"]
  ] as const) {
    const res = await withRetry(async () =>
      fetch(`https://api.npmjs.org/downloads/point/${period}/${encodeURIComponent(rawName)}`)
    );
    const text = res.status === 200 ? JSON.stringify(JSON.parse(await res.text())) : JSON.stringify({ downloads: 0 });
    writeFileSync(join(dir, file), text);
  }

  const osvRes = await withRetry(() =>
    fetch("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ package: { name: rawName, ecosystem: "npm" } })
    })
  );
  writeFileSync(join(dir, "osv.json"), await osvRes.text());

  return safe;
}

function safeName(rawName: string): string {
  return rawName.replace(/[^a-z0-9@._-]/gi, "_");
}

function verify(recordedAt: string, packages: string[]): string[] {
  const problems: string[] = [];
  for (const rawName of packages) {
    const dir = join(FIXTURES_DIR, safeName(rawName));
    try {
      const registry = JSON.parse(readFileSync(join(dir, "registry.json"), "utf8"));
      let week: unknown = null;
      try {
        week = JSON.parse(readFileSync(join(dir, "downloads-week.json"), "utf8"));
      } catch {}
      let month: unknown = null;
      try {
        month = JSON.parse(readFileSync(join(dir, "downloads-month.json"), "utf8"));
      } catch {}
      const parsed = parseNpmPackageData(rawName, registry, week, month);
      const osv = parseOsvResponse(JSON.parse(readFileSync(join(dir, "osv.json"), "utf8")));
      console.log(`  ${rawName}: latest=${parsed.latest} dl/week=${parsed.downloadsLastWeek ?? "?"} osv-vulns=${osv.vulns.length}`);
    } catch (e) {
      problems.push(`${rawName}: ${(e as Error).message}`);
    }
  }
  if (packages.length === 0) problems.push("no packages recorded");
  if (!recordedAt) problems.push("no meta timestamp");
  return problems;
}

const recordedAt = new Date().toISOString();
mkdirSync(FIXTURES_DIR, { recursive: true });

const recorded: string[] = [];
for (const pkg of PACKAGES) {
  try {
    const safe = await recordOne(pkg);
    recorded.push(pkg);
    console.log(`recorded ${pkg} -> ${safe}`);
  } catch (e) {
    console.error(`skip ${pkg}: ${(e as Error).message}`);
  }
}

const meta = { recordedAt, packages: recorded };
writeFileSync(join(FIXTURES_DIR, "meta.json"), JSON.stringify(meta, null, 2));

const problems = verify(recordedAt, recorded);
if (problems.length > 0) {
  console.error("fixture problems:", problems);
  process.exitCode = 1;
} else {
  console.log(`\nfixtures OK (recordedAt=${recordedAt}, ${recorded.length} packages)`);
}
