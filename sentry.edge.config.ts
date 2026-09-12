/**
 * Sentry — edge runtime (middleware.ts runs here) — Phase 16, P7.
 * See sentry.server.config.ts for the no-DSN-means-no-op reasoning.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.SENTRY_DSN,
});
