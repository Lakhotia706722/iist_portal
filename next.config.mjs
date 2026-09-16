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
      // pdfkit reads its own built-in font metrics (.afm files) from disk at
      // runtime via a plain relative path, not an import Next.js's bundler
      // can see statically — without this, Vercel's serverless file-tracing
      // never includes those data files, so PDF export works locally (full
      // node_modules on disk) but throws ENOENT for Helvetica.afm in
      // production. Marking it external makes Next.js trace and ship the
      // whole package (data files included) instead of webpack-bundling it.
      "pdfkit",
    ],
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

export default nextConfig;
