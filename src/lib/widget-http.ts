import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { rateBucketKey, rateLimitMax, rateWindowStart, RATE_WINDOW_MS } from "@/lib/rate-limit";
import { allowedDomainList, widgetWorkspace, type WidgetWorkspace } from "@/lib/widget";

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded.slice(0, 80);
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 80);
  return "unknown";
}

export async function takeRateLimit(publicKey: string, ip: string, now = Date.now()) {
  const start = rateWindowStart(now);
  const key = rateBucketKey(publicKey, ip);
  const result = await db.execute<{ count: number }>(sql`
    insert into widget_rate_bucket (bucket_key, window_start, count)
    values (${key}, ${start}, 1)
    on conflict (bucket_key) do update
    set
      count = case
        when widget_rate_bucket.window_start = ${start} then widget_rate_bucket.count + 1
        else 1
      end,
      window_start = ${start}
    returning count
  `);
  const count = Number(result.rows[0]?.count ?? 0);
  if (count === 1) {
    await db.execute(sql`
      delete from widget_rate_bucket
      where window_start < ${start - RATE_WINDOW_MS}
    `);
  }
  return count > 0 && count <= rateLimitMax();
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
  if (request.method !== "OPTIONS" && !(await takeRateLimit(key, clientIp(request)))) {
    return widgetJson({ error: "rate_limit" }, 429, request);
  }
  return { workspace, key };
}
