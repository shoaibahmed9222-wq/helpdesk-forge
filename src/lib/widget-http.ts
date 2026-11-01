import "server-only";

import { allowedDomainList, widgetWorkspace, type WidgetWorkspace } from "@/lib/widget";

const WINDOW_MS = 60_000;

type Bucket = { start: number; count: number };

function buckets() {
  const host = globalThis as typeof globalThis & { __hfWidgetRates?: Map<string, Bucket> };
  return (host.__hfWidgetRates ??= new Map());
}

function rateLimitMax() {
  const parsed = Number(process.env.WIDGET_RATE_LIMIT);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 1000) return parsed;
  return 20;
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded.slice(0, 80);
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 80);
  return "unknown";
}

export function takeRateLimit(publicKey: string, ip: string) {
  const now = Date.now();
  const store = buckets();
  const id = `${publicKey} ${ip}`;
  let bucket = store.get(id);
  if (!bucket || now - bucket.start >= WINDOW_MS) {
    bucket = { start: now, count: 0 };
    store.set(id, bucket);
  }
  bucket.count += 1;
  if (store.size > 2000) {
    for (const [key, value] of store) {
      if (now - value.start >= WINDOW_MS) store.delete(key);
    }
  }
  return bucket.count <= rateLimitMax();
}

export function browserOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function selfOrigin(request: Request) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    ?.trim();
  if (!host) return null;
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto =
    forwarded ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

export function originPermitted(request: Request, allowedDomains: string | null) {
  const domains = allowedDomainList(allowedDomains);
  const origin = browserOrigin(request);
  if (!origin) {
    if (domains.length === 0) return true;
    return request.headers.get("sec-fetch-site") === "same-origin";
  }
  if (origin === selfOrigin(request)) return true;
  if (domains.length === 0) return true;
  let host = "";
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  return domains.includes(host);
}

export function widgetPreflight(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export function widgetJson(body: unknown, status: number, request: Request) {
  const headers = corsHeaders(request);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

function corsHeaders(request: Request) {
  const headers = new Headers({ Vary: "Origin" });
  const origin = browserOrigin(request);
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "600");
  }
  return headers;
}

export async function gateWidget(request: Request): Promise<
  | { workspace: WidgetWorkspace; key: string }
  | Response
> {
  const key = new URL(request.url).searchParams.get("key")?.trim() ?? "";
  const workspace = key ? await widgetWorkspace(key) : null;
  if (!workspace) return widgetJson({ error: "unauthorized" }, 401, request);
  if (!originPermitted(request, workspace.allowedDomains)) {
    return widgetJson({ error: "forbidden" }, 403, request);
  }
  if (request.method !== "OPTIONS" && !takeRateLimit(key, clientIp(request))) {
    return widgetJson({ error: "rate_limit" }, 429, request);
  }
  return { workspace, key };
}
