import type { OsAdvisories, OsSeverity, OsVuln, ProviderSnapshot } from "../../engine/types.ts";
import { fetchJson, snapshotOf } from "./http.ts";

interface OsvResponse {
  vulns?: Array<{
    id?: string;
    summary?: string;
    database_specific?: { severity?: string };
    severity?: Array<{ type?: string; score?: unknown }>;
    affected?: Array<{ ecosystem_specific?: { severity?: string } }>;
    references?: Array<{ type?: string; url?: string }>;
  }>;
}

const NAMED_RANK: Record<string, OsSeverity> = {
  LOW: "LOW",
  MODERATE: "MODERATE",
  MEDIUM: "MODERATE",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL"
};

function severityFromCvss(score: unknown): OsSeverity {
  const n = typeof score === "number" ? score : typeof score === "string" ? Number(score) : Number.NaN;
  if (!Number.isFinite(n)) return "MODERATE";
  if (n >= 9) return "CRITICAL";
  if (n >= 7) return "HIGH";
  if (n >= 4) return "MODERATE";
  return "LOW";
}

function severityOf(v: NonNullable<OsvResponse["vulns"]>[number]): OsSeverity {
  const named = v.database_specific?.severity ?? v.affected?.[0]?.ecosystem_specific?.severity;
  if (named && NAMED_RANK[named.toUpperCase()]) return NAMED_RANK[named.toUpperCase()] as OsSeverity;

  const sev = v.severity?.[0];
  if (sev?.score) return severityFromCvss(sev.score);
  return "MODERATE";
}

export interface OsvFetch {
  data: OsAdvisories;
  snapshot: ProviderSnapshot;
}

export function parseOsvResponse(json: unknown): OsAdvisories {
  const data = json as OsvResponse;
  const vulns: OsVuln[] = (data.vulns ?? [])
    .filter((v): v is NonNullable<OsvResponse["vulns"]>[number] => typeof v === "object" && v !== null)
    .map((v) => ({
      id: typeof v.id === "string" ? v.id : "UNKNOWN",
      summary: typeof v.summary === "string" ? v.summary : "",
      severity: severityOf(v),
      refs: (v.references ?? [])
        .map((r) => r.url)
        .filter((u): u is string => typeof u === "string")
    }))
    .filter((v) => v.id !== "UNKNOWN");
  return { vulns };
}

export async function fetchAdvisories(name: string, now: string): Promise<OsvFetch> {
  const { json, digest } = await fetchJson("https://api.osv.dev/v1/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: { package: { name, ecosystem: "npm" } }
  });

  const result: OsvFetch = {
    data: parseOsvResponse(json),
    snapshot: snapshotOf("https://api.osv.dev/v1/query", digest, now)
  };
  return result;
}
