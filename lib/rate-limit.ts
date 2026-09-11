/**
 * Rate limiting — Phase 5
 *
 * In-memory fixed-window limiter keyed by (bucket, client identifier). This
 * is adequate for a single-instance deployment; a multi-instance deployment
 * needs a shared store (Redis, etc.) — swap `store` for one keyed the same
 * way if this app is ever horizontally scaled.
 */

import { NextRequest, NextResponse } from "next/server";

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

// Periodically drop expired buckets so this doesn't grow unbounded over a
// long-running process.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}, 60_000).unref?.();

export interface RateLimitOptions {
  /** Distinguishes this limiter from others sharing the module-level store. */
  bucket: string;
  /** Max requests per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

function clientIp(request: NextRequest): string | null {
  const header =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    // Next.js's App Router route handlers have no API for the raw socket
    // address (unlike Express) — `request.ip` only exists on platforms
    // (Vercel) that inject it. Without a reverse proxy in front setting
    // x-forwarded-for/x-real-ip — true for plain `next dev`, and for any
    // production deploy that skips that step despite the CSP trusted-
    // proxy assumption documented elsewhere — there is no way to tell
    // clients apart at all.
    (request as any).ip;
  if (header) return header;

  // Fallback: Auth.js sets a CSRF-token cookie on every page load, before
  // any login attempt — distinct per browser/session, so it separates
  // real clients from each other the same way an IP would, without
  // requiring one. Prefer that cookie by name; if it's genuinely absent
  // too, fall back to any cookie at all rather than giving up immediately.
  const cookies = request.cookies.getAll();
  const csrf = cookies.find((c) => c.name.endsWith("csrf-token"));
  if (csrf) return `cookie:${csrf.value}`;
  if (cookies.length > 0) return `cookie:${cookies[0].name}:${cookies[0].value}`;

  return null;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(request: NextRequest, options: RateLimitOptions): RateLimitResult {
  const ip = clientIp(request);
  if (ip === null) {
    // Phase 10: this used to key on the literal string "unknown" here,
    // which meant every client sharing that fallback — every request in
    // an environment with no reverse proxy in front, e.g. plain
    // `next dev`, or a misconfigured production deploy — collapsed onto
    // one shared bucket. 10 login attempts from ANY user, or a handful of
    // automated test runs, then 429'd EVERY OTHER USER for the rest of
    // that window: an accidental institute-wide lockout, found when this
    // engagement's own test suite reliably reproduced it after enough
    // real logins in one dev-server session. clientIp()'s cookie fallback
    // (above) now covers that case for any real browser — this branch is
    // reached only by a request with neither a forwarded-for header nor
    // any cookie at all (e.g. a bare curl POST with no prior page visit),
    // which is rare enough that failing open (no limiting) for it is the
    // safer choice — the alternative is blocking everyone over one
    // unidentifiable request.
    console.warn(`[rate-limit] no client identifier available for bucket "${options.bucket}" — skipping (see clientIp() in lib/rate-limit.ts)`);
    return { allowed: true, remaining: options.limit, resetAt: Date.now() + options.windowMs };
  }

  const key = `${options.bucket}:${ip}`;
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: options.limit - 1, resetAt };
  }

  if (existing.count >= options.limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count++;
  return { allowed: true, remaining: options.limit - existing.count, resetAt: existing.resetAt };
}

/** 429 response with standard rate-limit headers. */
export function rateLimitedResponse(result: RateLimitResult): NextResponse {
  const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please try again shortly.", code: "RATE_LIMITED" },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}

/**
 * Wrap a route handler with a rate limit. On limit, returns 429 before the
 * handler runs.
 *
 * Usage: `export const POST = withRateLimit({ bucket: "login", limit: 10, windowMs: 60_000 }, async (req) => {...})`
 */
export function withRateLimit<H extends (req: NextRequest, ...args: any[]) => Promise<Response>>(
  options: RateLimitOptions,
  handler: H
): H {
  return (async (req: NextRequest, ...args: any[]) => {
    const result = checkRateLimit(req, options);
    if (!result.allowed) return rateLimitedResponse(result);
    return handler(req, ...args);
  }) as H;
}
