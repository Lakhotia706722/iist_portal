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
      "pdfkit",
    ],
    // pdfkit's standard-font loader does `require('./standard-fonts/' + name
    // + '.cjs')` at runtime — the filename is built from a variable, not a
    // literal Next.js/Vercel's file tracer (@vercel/nft) can see statically,
    // so those .cjs modules never made it into the deployed serverless
    // function. Confirmed directly in production logs: "Cannot find module
    // '.../pdfkit/js/standard-fonts/Helvetica.cjs'" — PDF export throws on
    // every report despite working locally (full node_modules on disk) and
    // despite CSV/XLSX from the same route working fine. This explicitly
    // tells the tracer to include the whole directory for this route.
    outputFileTracingIncludes: {
      "/api/admin/reports/[type]": ["./node_modules/pdfkit/js/standard-fonts/**/*"],
    },
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
