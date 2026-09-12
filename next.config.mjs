import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Phase 5: lint debt is paid off — the build is now gated on a clean lint pass.
    ignoreDuringBuilds: false,
  },
  typescript: {
    // tsc --noEmit passes clean; allow build to proceed
    ignoreBuildErrors: false,
  },
  experimental: {
    serverComponentsExternalPackages: [
      "@prisma/client",
      "bcryptjs",
      "@aws-sdk/client-s3",
      "@aws-sdk/s3-request-presigner",
    ],
    // Phase 16 — P7: instrumentation.ts (Sentry's server/edge init hook)
    // — still behind this flag on 14.2.35.
    instrumentationHook: true,
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    // Phase 6: Content-Security-Policy is now nonce-based, generated per
    // request in middleware.ts (covers every page, including the
    // auth-excluded ones — see the matcher there) — NOT set here, since a
    // static header can't carry a per-request nonce. Everything else is a
    // fine static header.
    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
    ];

    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// Phase 16 — P7: uploads a source-map release to Sentry at build time —
// only actually does anything (and only needs SENTRY_AUTH_TOKEN) when
// SENTRY_DSN is set; harmless no-op wrapper otherwise, same as the config
// files themselves.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // No source-map upload without an auth token — never fail a build over
  // a missing optional credential.
  disableServerWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
  disableClientWebpackPlugin: !process.env.SENTRY_AUTH_TOKEN,
});
