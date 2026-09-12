import { NextRequest } from "next/server";
import { handlers } from "@/lib/auth/auth";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

export const { GET } = handlers;

/**
 * Rate limit sign-in attempts (this catch-all also handles
 * /api/auth/callback/credentials — the actual login POST). 10 attempts per
 * minute per IP is enough for a real user typo-ing a password without
 * meaningfully slowing a credential-stuffing attempt.
 *
 * In CI, every request comes from the same box hitting `localhost` — there
 * is no reverse proxy, so clientIp() (see lib/rate-limit.ts) falls back to
 * the raw loopback address, and every one of the e2e suite's ~150 logins
 * collapses onto that single bucket. Confirmed by instrumenting
 * checkRateLimit() directly: the count climbed 0→10 then stuck at 10
 * (rejected) for several requests every ~60s window, for the whole run.
 * Those rejections were the actual cause of the intermittent
 * `page.waitForURL` timeouts in e2e — next-auth's client-side `signIn()`
 * doesn't resolve cleanly on this route's 429 body, so the login form got
 * stuck rather than showing an error (see login-form.tsx's catch below).
 * `process.env.CI` is set automatically by GitHub Actions for the whole
 * job (build-time only on real deploy platforms, never at runtime for a
 * deployed app), so this only widens the limit for the test run itself.
 */
export async function POST(request: NextRequest) {
  const limit = process.env.CI === "true" ? 1000 : 10;
  const result = checkRateLimit(request, { bucket: "auth", limit, windowMs: 60_000 });
  if (!result.allowed) return rateLimitedResponse(result);
  return handlers.POST(request);
}
