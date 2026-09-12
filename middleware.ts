import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";
import { NextResponse, type NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

// Route prefix → allowed roles. Empty = any authenticated user.
const ROUTE_ROLES: Record<string, string[]> = {
  "/admin": ["TP_ADMIN"],
  "/faculty": ["FACULTY", "HOD"],
  "/hod": ["HOD"],
  "/company": ["COMPANY_REP"],
};

/** Pages that render without a session — no auth/role checks apply. */
const PUBLIC_PAGES = ["/login", "/forgot-password", "/reset-password", "/unauthorized"];

/** Phase 16 — P7.2: an uptime monitor has no session cookie — without
 * this, every hit against /api/health would 307 to /login instead of
 * running the actual health check. */
const PUBLIC_API_ROUTES = ["/api/health"];

/**
 * Phase 6: nonce-based CSP, generated fresh per request. Forwarded as an
 * `x-nonce` request header so Server Components can read it via
 * `headers().get("x-nonce")` for any inline <script> they render (Next's own
 * bootstrap script picks up the nonce from the response CSP header
 * automatically). `'unsafe-eval'` is dev-only (webpack HMR needs it); nothing
 * in the production bundle requires it.
 */
function buildCsp(nonce: string): string {
  const scriptSrc =
    process.env.NODE_ENV === "development"
      ? `'self' 'nonce-${nonce}' 'unsafe-eval'`
      : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Tailwind's dev-time runtime style injection needs 'unsafe-inline' here;
    // style tags can't carry a nonce the way <script> can without extra
    // plumbing through every UI library, and a style-src XSS is a much
    // narrower vector than script-src.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.anthropic.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

function withCsp(response: NextResponse, nonce: string): NextResponse {
  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  return response;
}

export default auth(function middleware(req: NextRequest & { auth: any }) {
  const { nextUrl } = req;
  const { pathname } = nextUrl;

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  const next = () => NextResponse.next({ request: { headers: requestHeaders } });
  const redirect = (url: URL) => NextResponse.redirect(url);

  // Public auth pages: no session required, but they still get the same CSP.
  if (PUBLIC_PAGES.some((p) => pathname.startsWith(p))) {
    return withCsp(next(), nonce);
  }

  // Public API routes (health check) — no session, no CSP concerns (no HTML).
  if (PUBLIC_API_ROUTES.some((p) => pathname.startsWith(p))) {
    return next();
  }

  const session = (req as any).auth;

  if (!session?.user) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return withCsp(redirect(loginUrl), nonce);
  }

  const role: string = session.user.role ?? "";
  const mustChangePassword: boolean = session.user.mustChangePassword ?? false;
  const onboardingStep: number = session.user.onboardingStep ?? 0;

  // Force password change
  if (
    mustChangePassword &&
    !pathname.startsWith("/settings/change-password") &&
    !pathname.startsWith("/api/")
  ) {
    return withCsp(
      redirect(new URL("/settings/change-password?forced=true", nextUrl.origin)),
      nonce
    );
  }

  // Force onboarding for incomplete students
  if (
    role === "STUDENT" &&
    onboardingStep < 2 &&
    !pathname.startsWith("/onboarding") &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/settings")
  ) {
    return withCsp(redirect(new URL("/onboarding", nextUrl.origin)), nonce);
  }

  // Role guards
  for (const [route, allowed] of Object.entries(ROUTE_ROLES)) {
    if (pathname.startsWith(route) && !allowed.includes(role)) {
      return withCsp(redirect(new URL("/unauthorized", nextUrl.origin)), nonce);
    }
  }

  return withCsp(next(), nonce);
});

export const config = {
  // Phase 6: the auth pages are now included (not excluded) so they get a
  // CSP nonce too — the function above skips their auth/role checks itself.
  // api/auth stays excluded (NextAuth's own routes; no HTML to protect).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
