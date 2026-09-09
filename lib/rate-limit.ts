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

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(request: NextRequest, options: RateLimitOptions): RateLimitResult {
  const key = `${options.bucket}:${clientIp(request)}`;
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
