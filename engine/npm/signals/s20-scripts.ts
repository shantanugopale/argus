import type { NpmScanContext, SignalFinding } from "../../types.ts";
import { DOC_URLS } from "../../types.ts";

const LIFECYCLE_HOOKS = new Set(["preinstall", "install", "postinstall", "prepack", "prepare"]);
const SUSPICIOUS_EXECUTABLE = /(curl|wget|powershell|node\s+-e|python\s+-c|child_process|eval|atob|base64\s+(--)?(--)?decode|http|download|customerId|\.discord\.(com|me)|webhook)/i;

const LIFECYCLE_EXPLANATIONS: Record<string, string> = {
  preinstall: "runs before files are on disk",
  install: "runs during install",
  postinstall: "runs immediately on install",
  prepack: "runs when the tarball is packed",
  prepare: "runs on local installs"
};

export function signalInstallScripts(ctx: NpmScanContext): SignalFinding | null {
  const hooks = Object.entries(ctx.npm.scripts).filter(([k]) => LIFECYCLE_HOOKS.has(k));
  if (hooks.length === 0) return null;

  const dangerous = hooks.filter(([, cmd]) => SUSPICIOUS_EXECUTABLE.test(cmd));
  if (dangerous.length > 0) {
    const detail = dangerous.map(([k, cmd]) => `${k}: ${cmd.slice(0, 120)}`).join(" | ");
    return {
      id: "S20",
      title: "Install scripts executing suspicious commands",
      points: 60,
      floor: "HIGH_RISK",
      severe: true,
      evidence: `Lifecycle hook${dangerous.length > 1 ? "s" : ""} run code at install time on every consumer machine (${detail})`,
      refs: [DOC_URLS.S20 ?? ""]
    };
  }

  const detail = hooks.map(([k]) => `${k} (${LIFECYCLE_EXPLANATIONS[k] ?? ""})`).join(", ");
  return {
    id: "S20",
    title: "Install lifecycle scripts present",
    points: 25,
    severe: false,
    evidence: `Package defines install-time lifecycle script${hooks.length > 1 ? "s" : ""} — code runs on every consumer machine: ${detail}`,
    refs: [DOC_URLS.S20 ?? ""]
  };
}
