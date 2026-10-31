import { after, describe, it } from "node:test";
import { ok, strictEqual } from "node:assert";
import { server } from "../../apps/api/server.ts";

const PORT = await new Promise<number>((resolve) => {
  server.listen(0, "127.0.0.1", () => resolve((server.address() as { port: number }).port));
});
after(() => {
  server.close();
});
const BASE = `http://127.0.0.1:${PORT}`;

async function get(path: string): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const r = await fetch(`${BASE}${path}`);
  const body = (await r.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: r.status, body };
}

describe("api smoke", () => {
  it("healthz responds ok", async () => {
    const r = await get("/healthz");
    strictEqual(r.status, 200);
    strictEqual(r.body?.ok, true);
    ok(typeof r.body?.uptimeMs === "number");
  });

  it("unknown path -> 404 json", async () => {
    const r = await get("/definitely-not-here");
    strictEqual(r.status, 404);
    ok(typeof r.body?.error === "string");
  });

  it("scan without ref -> 400 with guidance", async () => {
    const r = await get("/api/scan");
    strictEqual(r.status, 400);
    ok(typeof r.body?.error === "string" && r.body.error.length > 4);
  });

  it("scan with malformed gh ref -> 400", async () => {
    const r = await get("/api/scan?ref=gh:not-a-slash");
    strictEqual(r.status, 400);
    ok(typeof r.body?.error === "string");
  });

  it("POST to read endpoints -> 405", async () => {
    const r = await fetch(`${BASE}/api/scan`, { method: "POST" });
    strictEqual(r.status, 405);
  });

  it("scans history endpoint returns array", async () => {
    const r = await get("/api/scans");
    strictEqual(r.status, 200);
    ok(Array.isArray(r.body));
  });
});
