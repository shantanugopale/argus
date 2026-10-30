import { createHash } from "node:crypto";
import type { ProviderSnapshot } from "../../engine/types.ts";

export interface HttpResult {
  json: unknown;
  digest: string;
}

export interface TextResult {
  text: string;
  digest: string;
}

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;
  constructor(status: number, url: string) {
    super(`HTTP ${status} from ${url}`);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
  }
}

interface CacheEntry {
  etag: string | null;
  raw: string;
}

const cache = new Map<string, CacheEntry>();

function digestOf(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function sourceOf(url: string): string {
  const schemeIdx = url.indexOf("://");
  if (schemeIdx === -1) return url;
  const rest = url.slice(schemeIdx + 3);
  const slashIdx = rest.indexOf("/");
  return slashIdx === -1 ? rest : rest.slice(0, slashIdx);
}

export function snapshotOf(
  label: string,
  digest: string,
  now: string,
  degraded = false
): ProviderSnapshot {
  const url = label.startsWith("http") ? label : `argus://${label.replace(/ /g, "-")}`;
  return {
    source: sourceOf(url),
    url,
    fetchedAt: now,
    digest,
    degraded
  };
}

interface FetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  method?: "GET" | "POST";
  body?: unknown;
}

async function fetchRaw(url: string, opts: FetchOptions): Promise<{ text: string; status: number }> {
  const { method = "GET", body, headers = {}, timeoutMs = 30_000, retries = 1 } = opts;

  const requestHeaders: Record<string, string> = { ...headers, "accept-encoding": "gzip" };
  const cached = cache.get(url);
  if (cached?.etag && method === "GET") requestHeaders["if-none-match"] = cached.etag;

  let attempt = 0;
  for (;;) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        signal: controller.signal,
        body: body === undefined ? undefined : JSON.stringify(body)
      });

      if (response.status === 304 && cached && method === "GET") {
        return { text: cached.raw, status: 304 };
      }

      if (response.status === 429 || response.status >= 500) {
        void response.arrayBuffer().catch(() => {});
        if (attempt < retries) {
          attempt++;
          await new Promise((r) => setTimeout(r, 400 * attempt));
          continue;
        }
        throw new HttpError(response.status, url);
      }

      if (!response.ok) {
        void response.arrayBuffer().catch(() => {});
        throw new HttpError(response.status, url);
      }

      const etag = response.headers.get("etag");
      const text = await response.text();

      if (method === "GET" && !cache.has(url)) cache.set(url, { etag, raw: text });

      return { text, status: response.status };
    } catch (e) {
      if (e instanceof HttpError) throw e;
      if (attempt < retries && e instanceof Error && (e.name === "AbortError" || e.name === "TypeError")) {
        attempt++;
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }
      throw new HttpError(-2, url);
    } finally {
      clearTimeout(timer);
    }
  }
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<TextResult> {
  const { text } = await fetchRaw(url, opts);
  return { text, digest: digestOf(text) };
}

export async function fetchJson(url: string, opts: FetchOptions = {}): Promise<HttpResult> {
  const { text } = await fetchRaw(url, opts);
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(-1, url);
  }
  return { json, digest: digestOf(text) };
}
