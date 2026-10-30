import type { ScanRef } from "../engine/types.ts";

export class UnsupportedRefError extends Error {
  readonly refName: string;
  constructor(ref: ScanRef) {
    super(`Unsupported scan ref "${ref.name}" for ecosystem "${ref.ecosystem}"`);
    this.name = "UnsupportedRefError";
    this.refName = ref.name;
  }
}

export function parseRef(raw: string): ScanRef {
  const trimmed = raw.trim();
  const gh = /^gh:(.+)$/i.exec(trimmed);
  const npm = /^npm[:@](.+)$/i.exec(trimmed);

  if (gh?.[1]) {
    if (!gh[1].includes("/")) throw new Error(`GitHub ref "gh:${gh[1]}" must be owner/repo`);
    return { ecosystem: "github", name: gh[1] };
  }
  if (npm?.[1]) return { ecosystem: "npm", name: npm[1] };
  if (trimmed.includes("/")) return { ecosystem: "github", name: trimmed };
  return { ecosystem: "npm", name: trimmed };
}
