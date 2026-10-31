import type { GithubRepoData, GithubRepoManifest } from "../types.ts";

export interface GithubApiRepoDoc {
  full_name?: string;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  license?: { spdx_id?: string | null } | null;
  description?: string | null;
  created_at?: string;
  pushed_at?: string;
  topics?: unknown;
  owner?: { type?: string };
  archived?: boolean;
}

export function parseRepoManifest(json: unknown): GithubRepoManifest | null {
  if (json === null || typeof json !== "object") return null;
  const m = json as Record<string, unknown>;
  const deps = m["dependencies"];
  const devDeps = m["devDependencies"];
  if (deps === undefined && devDeps === undefined) return null;
  return {
    dependencies: isStringMap(deps) ? deps : undefined,
    devDependencies: isStringMap(devDeps) ? devDeps : undefined
  };
}

function isStringMap(v: unknown): v is Record<string, string> | undefined {
  if (v === undefined || v === null) return false;
  if (typeof v !== "object") return false;
  return Object.values(v as Record<string, unknown>).every((x) => typeof x === "string");
}

export function parseGithubRepoDoc(json: unknown, manifest: GithubRepoManifest | null, fullNameFallback: string): GithubRepoData {
  const doc = json as GithubApiRepoDoc;
  const topics = Array.isArray(doc.topics) ? doc.topics.filter((t): t is string => typeof t === "string") : [];
  return {
    fullName: typeof doc.full_name === "string" ? doc.full_name : fullNameFallback,
    stars: typeof doc.stargazers_count === "number" && doc.stargazers_count >= 0 ? doc.stargazers_count : 0,
    forks: typeof doc.forks_count === "number" && doc.forks_count >= 0 ? doc.forks_count : 0,
    openIssues: typeof doc.open_issues_count === "number" && doc.open_issues_count >= 0 ? doc.open_issues_count : 0,
    licenseSpdx: doc.license?.spdx_id && doc.license.spdx_id !== "NOASSERTION" ? doc.license.spdx_id : null,
    description: typeof doc.description === "string" ? doc.description : "",
    createdAt: typeof doc.created_at === "string" ? doc.created_at : "",
    pushedAt: typeof doc.pushed_at === "string" ? doc.pushed_at : "",
    topics,
    ownerType: typeof doc.owner?.type === "string" ? doc.owner.type : "unknown",
    archived: doc.archived === true,
    manifest
  };
}
