/**
 * Sentry — server runtime — Phase 16, P7.
 *
 * Initializes even without SENTRY_DSN set (matches this project's
 * established "no-DSN/no-key means feature quietly no-ops" convention —
 * see AI_PROVIDER, STORAGE_DRIVER, UPSTASH_*): Sentry.init() with an
 * empty dsn is a documented no-op, so local dev never needs a real
 * Sentry project.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Placement-season traffic is bursty but not enormous — 100% error
  // capture, a modest trace sample (cost control on Sentry's own
  // quota, not this app's infra) rather than 100% tracing.
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.SENTRY_DSN,
});
