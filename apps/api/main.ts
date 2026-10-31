import { server } from "./server.ts";

const PORT = Number(process.env["ARGUS_PORT"] ?? 8787);
server.listen(PORT, "127.0.0.1", () => {
  console.log(`argus api  ▸ http://127.0.0.1:${PORT}`);
  console.log("endpoints  ▸ GET /  ·  /healthz  ·  /api/trend?top&days  ·  /api/scan?ref  ·  /api/scans");
});
