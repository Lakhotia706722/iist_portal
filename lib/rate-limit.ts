/**
 * Rate limiting — Phase 5, replaced with a distributed backend in Phase 16.
 *
 * Phase 5's limiter was a module-level in-memory Map — correct on a single
 * long-lived process, but silently ineffective on Vercel: every serverless
 * function instance gets its own memory, so "10 requests per minute" really
 * meant "10 requests per minute *per instance*", and real concurrent load
 * spins up many instances. A client hitting different instances (or just
 * getting unlucky with which one handles each request) could blow past the
 * intended limit by a large multiple without ever seeing a 429.
 *
 * Phase 16 — P2: Upstash Redis (`@upstash/ratelimit` + `@upstash/redis`) is
 * the shared, HTTP-based store every instance talks to, so the limit is now
 * enforced against the same counter regardless of which instance a request
 * lands on. It activates automatically when UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are set; without them (local dev, or before
 * those credentials are provisioned) this falls back to the original
 * in-memory limiter — correct for local dev, but NOT distributed, and a
 * console warning says so once per process so this is never silently
 * relied on in a real multi-instance deployment.
 */

import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitOptions {
  /** Distinguishes this limiter from others sharing the module-level store. */
  bucket: string;
  /** Max requests per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// ─── Distributed backend (Upstash Redis) ──────────────────────────────────────

const UPSTASH_CONFIGURED = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

let redis: Redis | null = null;
// One Ratelimit instance per (bucket, limit, windowMs) triple — each needs
// its own sliding window, and constructing it is cheap, so cache by a key
// derived from the options rather than re-building per request.
const limiters = new Map<string, Ratelimit>();

function getLimiter(options: RateLimitOptions): Ratelimit {
  const cacheKey = `${options.bucket}:${options.limit}:${options.windowMs}`;
  let limiter = limiters.get(cacheKey);
  if (limiter) return limiter;

  if (!redis) redis = Redis.fromEnv();
  limiter = new Ratelimit({
    redis,
    // Sliding window, not fixed — avoids the fixed-window edge case where a
    // client can burst up to 2x the limit right across a window boundary.
    limiter: Ratelimit.slidingWindow(options.limit, `${options.windowMs} ms`),
    prefix: `ratelimit:${options.bucket}`,
    analytics: false,
  });
  limiters.set(cacheKey, limiter);
  return limiter;
}

async function checkRateLimitDistributed(clientId: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const limiter = getLimiter(options);
  const result = await limiter.limit(clientId);
  return { allowed: result.success, remaining: result.remaining, resetAt: result.reset };
}

// ─── In-memory fallback (Phase 5 — local dev / no Upstash configured) ─────────

interface Bucket {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, Bucket>();

// Periodically drop expired buckets so this doesn't grow unbounded over a
// long-running process.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of memoryStore) {
    if (bucket.resetAt <= now) memoryStore.delete(key);
  }
}, 60_000).unref?.();

let warnedNotDistributed = false;

function checkRateLimitInMemory(clientId: string, options: RateLimitOptions): RateLimitResult {
  if (!warnedNotDistributed) {
    warnedNotDistributed = true;
    console.warn(
      "[rate-limit] UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set — using the in-memory fallback " +
        "limiter. This is fine for local dev, but on a multi-instance deployment (Vercel serverless) it does " +
        "NOT enforce a shared limit across instances. Set both env vars before going to production."
    );
  }

  const key = `${options.bucket}:${clientId}`;
  const now = Date.now();
  const existing = memoryStore.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: options.limit - 1, resetAt };
  }

  if (existing.count >= options.limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count++;
  return { allowed: true, remaining: options.limit - existing.count, resetAt: existing.resetAt };
}

// ─── Client identification (shared by both backends) ──────────────────────────

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

/**
 * Check (and consume, if allowed) one request against a rate limit bucket,
 * keyed by an explicit identity rather than IP/cookie — use this for any
 * authenticated per-user limit (e.g. "N AI generations per student per
 * day"), where the acting user's real id is a correct, stable key and IP
 * is not (multiple students behind the same NAT share an IP; one student
 * switching networks would otherwise dodge their own limit).
 */
export async function checkRateLimitForKey(clientId: string, options: RateLimitOptions): Promise<RateLimitResult> {
  if (UPSTASH_CONFIGURED) {
    try {
      return await checkRateLimitDistributed(clientId, options);
    } catch (err) {
      console.error(`[rate-limit] Upstash request failed for bucket "${options.bucket}" — failing open:`, err);
      return { allowed: true, remaining: options.limit, resetAt: Date.now() + options.windowMs };
    }
  }
  return checkRateLimitInMemory(clientId, options);
}

/**
 * Check (and consume, if allowed) one request against a rate limit bucket,
 * keyed by client IP (falling back to a session cookie — see clientIp()).
 * Use this for anonymous/pre-auth endpoints (login, password reset) where
 * there is no user id yet to key on.
 */
export async function checkRateLimit(request: NextRequest, options: RateLimitOptions): Promise<RateLimitResult> {
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

  return checkRateLimitForKey(ip, options);
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
    const result = await checkRateLimit(req, options);
    if (!result.allowed) return rateLimitedResponse(result);
    return handler(req, ...args);
  }) as H;
}

/** Test/verification seam — drop cached limiter instances (e.g. after changing env). */
export function resetRateLimiters(): void {
  redis = null;
  limiters.clear();
  memoryStore.clear();
  warnedNotDistributed = false;
}
