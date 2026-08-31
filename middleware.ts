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

export default auth(function middleware(req: NextRequest & { auth: any }) {
  const { nextUrl } = req;
  const session = (req as any).auth;
  const { pathname } = nextUrl;

  if (!session?.user) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role: string = session.user.role ?? "";
  const mustChangePassword: boolean = session.user.mustChangePassword ?? false;
  const onboardingStep: number = session.user.onboardingStep ?? 0;

  // Force password change
  if (
    mustChangePassword &&
    !pathname.startsWith("/settings/change-password") &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/login")
  ) {
    return NextResponse.redirect(
      new URL("/settings/change-password?forced=true", nextUrl.origin)
    );
  }

  // Force onboarding for incomplete students
  if (
    role === "STUDENT" &&
    onboardingStep < 2 &&
    !pathname.startsWith("/onboarding") &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/settings") &&
    !pathname.startsWith("/login")
  ) {
    return NextResponse.redirect(new URL("/onboarding", nextUrl.origin));
  }

  // Role guards
  for (const [route, allowed] of Object.entries(ROUTE_ROLES)) {
    if (pathname.startsWith(route) && !allowed.includes(role)) {
      return NextResponse.redirect(new URL("/unauthorized", nextUrl.origin));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|forgot-password|reset-password|unauthorized|api/auth).*)",
  ],
};
