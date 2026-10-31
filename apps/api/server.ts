import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ScanRef } from "../../engine/types.ts";
import { buildTrendReport } from "../../engine/trend/build-trend.ts";
import { fetchDownloadsRange } from "../../shell/connectors/npm-downloads.ts";
import { fetchGithubTrending } from "../../shell/connectors/github-trending.ts";
import { POPULAR_NAMES } from "../../engine/npm/top-index.ts";
import { analyzeRef } from "../../engine/analyze-ref.ts";
import { buildLiveProviders } from "../../shell/connectors/providers.ts";
import { PackageNotFoundError } from "../../shell/connectors/npm-registry.ts";
import { RepoNotFoundError } from "../../shell/connectors/github-api.ts";
import { UnsupportedRefError } from "../../shell/parse-ref.ts";
import { ArgusStore } from "../../shell/persistence/argus-store.ts";
import { parseRef } from "../../shell/parse-ref.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const store = new ArgusStore();

export interface PersistedScanMeta {
  ref: string;
  verdict: string;
  score: number;
  checkedAt: string;
  persistedAt: string;
}

function json(res: ServerResponse, code: number, body: unknown): void {
  const raw = JSON.stringify(body);
  res.writeHead(code, { "content-type": "application/json", "content-length": Buffer.byteLength(raw) });
  res.end(raw);
}

function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
  const n = raw === null ? NaN : Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

async function handleTrend(res: ServerResponse, url: URL): Promise<void> {
  const top = clampInt(url.searchParams.get("top"), 1, 150, 15);
  const days = clampInt(url.searchParams.get("days"), 2, 30, 14);
  const now = new Date().toISOString();

  const names = POPULAR_NAMES.slice(0, top);
  const seriesByName = new Map<string, number[]>();
  const digests: string[] = [];
  await Promise.all(
    names.map(async (name) => {
      try {
        const r = await fetchDownloadsRange(name, days, "argus-supply-chain-radar/+api", now);
        seriesByName.set(name, r.series);
        digests.push(r.snapshot.digest.slice(0, 12));
      } catch {}
    })
  );

  let repos: Array<{ repo: string; starsThisPeriod: number; period: string }> = [];
  try {
    const gh = await fetchGithubTrending(now);
    repos = gh.repos;
  } catch {}

  const report = buildTrendReport({ generatedAt: now, windowDays: days, seriesByName, repos, snapshotDigests: digests });
  store.saveTrendSnapshot(report, now);
  json(res, 200, report);
}

async function handleScan(res: ServerResponse, url: URL): Promise<void> {
  const raw = url.searchParams.get("ref") ?? "";
  if (raw.trim().length === 0) {
    json(res, 400, { error: "missing ref parameter (?ref=npm:chalk or gh:owner/repo)" });
    return;
  }

  let ref: ScanRef;
  try {
    ref = parseRef(raw);
  } catch (e) {
    json(res, 400, { error: e instanceof Error ? e.message : String(e) });
    return;
  }

  const cached = store.loadScan(ref.name, 60_000);
  if (cached) {
    json(res, 200, { ...cached.report, cached: true, persistedAt: cached.persistedAt });
    return;
  }

  const now = new Date().toISOString();
  const providers = buildLiveProviders();
  try {
    const report = await analyzeRef(ref, { providers, now });
    store.saveScan(report, now);
    json(res, 200, report);
  } catch (e) {
    if (e instanceof PackageNotFoundError || e instanceof RepoNotFoundError) {
      json(res, 404, { error: e.message });
    } else if (e instanceof UnsupportedRefError) {
      json(res, 400, { error: e.message });
    } else {
      json(res, 502, { error: e instanceof Error ? `${e.name}: ${e.message}` : "upstream failure" });
    }
  }
}

function handleHistory(res: ServerResponse): void {
  json(res, 200, store.listScansMeta());
}

function serveIndex(res: ServerResponse): void {
  try {
    const html = readFileSync(join(HERE, "..", "web", "index.html"), "utf8");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  } catch {
    json(res, 500, { error: "dashboard asset missing" });
  }
}

export const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (req.method !== "GET" && url.pathname !== "/healthz") {
    json(res, 405, { error: "method not allowed" });
    return;
  }

  try {
    if (url.pathname === "/healthz") {
      json(res, 200, { ok: true, uptimeMs: Math.round(process.uptime() * 1000) });
      return;
    }
    if (url.pathname === "/api/trend") {
      await handleTrend(res, url);
      return;
    }
    if (url.pathname === "/api/scan") {
      await handleScan(res, url);
      return;
    }
    if (url.pathname === "/api/scans") {
      handleHistory(res);
      return;
    }
    if (url.pathname === "/") {
      serveIndex(res);
      return;
    }
    json(res, 404, { error: "not found" });
  } catch (e) {
    json(res, 500, { error: e instanceof Error ? e.message : "internal error" });
  }
});
