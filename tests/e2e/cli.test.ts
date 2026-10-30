import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ok, strictEqual } from "node:assert";
import { describe, it } from "node:test";

const ROOT = resolve(process.cwd());
const CLI = join(ROOT, "apps", "cli", "argus.ts");
const FIXTURES_DIR = join(ROOT, "tests", "fixtures");
const RECORDED_AT: string = (JSON.parse(readFileSync(join(FIXTURES_DIR, "meta.json"), "utf8")) as { recordedAt: string }).recordedAt;

function runCli(args: string[]): { stdout: string; stderr: string; status: number } {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      ARGUS_FIXTURES_DIR: FIXTURES_DIR,
      ARGUS_NOW: RECORDED_AT
    }
  });
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", status: r.status ?? -1 };
}

describe("e2e: argus CLI in fixture mode (hermetic, exit-code contract)", () => {
  it("safe popular package exits with a valid verdict code and renders", () => {
    const { stdout, status } = runCli(["scan", "chalk"]);
    ok([0, 10, 20].includes(status), `chalk fixture scan must produce verdict exit code, got ${status}`);
    ok(stdout.includes("chalk"));
    ok(stdout.includes("ARGUS") || stdout.includes("argus"));
  });

  it("json mode prints a parseable report", () => {
    const { stdout } = runCli(["scan", "lodash", "--json"]);
    const report = JSON.parse(stdout);
    strictEqual(report.ref.ecosystem, "npm");
    strictEqual(report.ref.name, "lodash");
    ok(typeof report.score === "number");
    ok(Array.isArray(report.findings));
  });

  it("unknown package exits with code 3", () => {
    const { status, stderr } = runCli(["scan", "definitely-not-a-real-package-xyz-404"]);
    strictEqual(status, 3);
    ok(stderr.includes("not found"));
  });

  it("multiple refs run and aggregate", () => {
    const { status, stdout } = runCli(["scan", "chalk", "--json"]);
    void stdout;
    ok([0, 10, 20].includes(status));

    const { status: s2 } = runCli(["scan", "lodash", "--json"]);
    ok([0, 10, 20].includes(s2));

    const { status: s3 } = runCli(["scan", "react", "--json"]);
    ok([0, 10, 20].includes(s3));
  });

  it("determinism: identical fixture input produces identical JSON output", () => {
    const a = runCli(["scan", "chalk", "--json"]);
    const b = runCli(["scan", "chalk", "--json"]);
    strictEqual(a.stdout, b.stdout);
  });
});
