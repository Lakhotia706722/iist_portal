/**
 * Sentry — browser runtime — Phase 16, P7. Loaded automatically by
 * Next.js (the current Sentry Next.js SDK convention — replaces the
 * older sentry.client.config.ts file). See sentry.server.config.ts for
 * the no-DSN-means-no-op reasoning.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Client-side errors carry no server session context by default —
  // nothing here needs it; server-side capture (see
  // lib/rbac/server-guard.ts / lib/api-utils.ts) is what attaches
  // user/role/route.
});

// Required for Sentry's App Router navigation instrumentation.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
