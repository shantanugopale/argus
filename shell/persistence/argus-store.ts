import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ScanReport } from "../../engine/types.ts";

function digestOf(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function safeRefName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "__");
}

export interface PersistedScan {
  report: ScanReport;
  persistedAt: string;
  digest: string;
}

export class ArgusStore {
  private readonly root: string;

  constructor(root: string = join(process.cwd(), ".argus")) {
    this.root = root;
    mkdirSync(join(this.root, "scans"), { recursive: true });
    mkdirSync(join(this.root, "trend"), { recursive: true });
  }

  scanPath(refName: string): string {
    return join(this.root, "scans", `${safeRefName(refName)}.json`);
  }

  saveScan(report: ScanReport, persistedAt: string): boolean {
    try {
      const raw = JSON.stringify(report);
      const envelope: PersistedScan = { report, persistedAt, digest: digestOf(raw) };
      writeFileSync(this.scanPath(report.ref.name), JSON.stringify(envelope, null, 1));
      return true;
    } catch {
      return false;
    }
  }

  loadScan(refName: string, ttlMs: number): PersistedScan | null {
    const p = this.scanPath(refName);
    if (!existsSync(p)) return null;
    try {
      const envelope = JSON.parse(readFileSync(p, "utf8")) as PersistedScan;
      const raw = JSON.stringify(envelope.report);
      if (digestOf(raw) !== envelope.digest) {
        try { rmSync(p); } catch {}
        return null;
      }
      const age = Date.now() - Date.parse(envelope.persistedAt);
      if (Number.isNaN(age) || age < 0 || age > ttlMs) return null;
      return envelope;
    } catch {
      return null;
    }
  }

  clearScan(refName: string): void {
    try { rmSync(this.scanPath(refName), { force: true }); } catch {}
  }

  saveTrendSnapshot(report: unknown, persistedAt: string): void {
    try {
      writeFileSync(join(this.root, "trend", "latest.json"), JSON.stringify({ report, persistedAt }, null, 1));
    } catch {}
  }

  listScansMeta(): Array<{ ref: string; verdict: string; score: number; checkedAt: string; persistedAt: string }> {
    const out: Array<{ ref: string; verdict: string; score: number; checkedAt: string; persistedAt: string }> = [];
    try {
      for (const f of readdirSync(join(this.root, "scans"))) {
        if (!f.endsWith(".json")) continue;
        try {
          const envelope = JSON.parse(readFileSync(join(this.root, "scans", f), "utf8")) as PersistedScan;
          out.push({
            ref: envelope.report.ref.name,
            verdict: envelope.report.verdict,
            score: envelope.report.score,
            checkedAt: envelope.report.checkedAt,
            persistedAt: envelope.persistedAt
          });
        } catch {}
      }
    } catch {}
    return out.sort((a, b) => b.persistedAt.localeCompare(a.persistedAt));
  }
}
