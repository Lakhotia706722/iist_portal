import type { NextAuthConfig } from "next-auth";

// Type augmentations live in types/next-auth.d.ts

export const authConfig: NextAuthConfig = {
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
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as any).role;
        token.mustChangePassword = (user as any).mustChangePassword;
        token.studentId = (user as any).studentId;
        token.enrollmentNumber = (user as any).enrollmentNumber;
        token.onboardingStep = (user as any).onboardingStep;
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
