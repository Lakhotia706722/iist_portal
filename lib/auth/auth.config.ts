import type { NextAuthConfig } from "next-auth";

// Type augmentations live in types/next-auth.d.ts

export const authConfig: NextAuthConfig = {
  // Phase 10: without this, Auth.js builds every absolute redirect URL
  // (the credentials-callback 302, error-page redirects, etc.) from
  // NEXTAUTH_URL alone, ignoring the actual incoming request's Host —
  // harmless for the common case (default `next dev` on :3000, matching
  // .env's NEXTAUTH_URL exactly) but silently sends anyone hitting the
  // app on any other host/port (this app's own documented E2E convention
  // of running on :4242, or any real deployment behind a different host)
  // through a redirect to a dead origin. `trustHost: true` makes Auth.js
  // use the request's own Host header instead, which is correct here —
  // this app has no untrusted-proxy exposure to spoof it (see
  // ARCHITECTURE.md's CSP section for the trusted-proxy assumption).
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      const isAuthPage =
        pathname.startsWith("/login") ||
        pathname.startsWith("/forgot-password") ||
        pathname.startsWith("/reset-password");

      if (isAuthPage) {
        if (isLoggedIn) return Response.redirect(new URL("/dashboard", nextUrl));
        return true;
      }

      if (!isLoggedIn) return false;
      return true;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as any).role;
        token.mustChangePassword = (user as any).mustChangePassword;
        token.studentId = (user as any).studentId;
        token.enrollmentNumber = (user as any).enrollmentNumber;
        token.onboardingStep = (user as any).onboardingStep;
      }
      // Phase 10: middleware's role/onboarding/forced-password-change gates
      // (below) all read straight off this JWT, which by default is only
      // populated at sign-in — a server-side mutation that changes
      // onboardingStep or mustChangePassword (finishing the onboarding
      // wizard; changing a forced password) never touches it. That produced
      // a genuine infinite redirect loop in both flows: complete step 2 ->
      // router.push("/student/dashboard") -> middleware still sees the old
      // onboardingStep from the stale token -> redirect back to
      // /onboarding -> repeat, only breakable by a full re-login. This lets
      // client code call next-auth/react's `update({...})` right after such
      // a mutation to patch the token in place (see academic-info-form.tsx,
      // change-password-form.tsx).
      if (trigger === "update" && session) {
        if (typeof session.onboardingStep === "number") token.onboardingStep = session.onboardingStep;
        if (typeof session.mustChangePassword === "boolean") token.mustChangePassword = session.mustChangePassword;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as any;
        session.user.mustChangePassword = token.mustChangePassword as boolean;
        session.user.studentId = token.studentId as string | undefined;
        session.user.enrollmentNumber = token.enrollmentNumber as string | undefined;
        session.user.onboardingStep = token.onboardingStep as number | undefined;
      }
      return session;
    },
  },
  providers: [],
};
