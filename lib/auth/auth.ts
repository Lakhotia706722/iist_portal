import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";
import { loginSchema } from "@/lib/validations/auth";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        enrollmentNumber: { label: "Enrollment Number", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // TEMPORARY — CI login-timeout investigation. Gated off by default;
        // set DEBUG_AUTH_TIMING=true to enable. Remove once the bottleneck
        // behind the intermittent CI `waitForURL` timeouts is confirmed fixed.
        const debugTiming = process.env.DEBUG_AUTH_TIMING === "true";
        const t0 = debugTiming ? performance.now() : 0;

        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { enrollmentNumber, password } = parsed.data;

        // Look up by enrollment number (student) or email (staff)
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { student: { enrollmentNumber } },
              { email: enrollmentNumber }, // staff use email as login ID
            ],
            isActive: true,
          },
          include: {
            student: {
              select: {
                id: true,
                enrollmentNumber: true,
                onboardingStep: true,
              },
            },
          },
        });
        const tLookup = debugTiming ? performance.now() : 0;
        if (debugTiming) console.log(`[AUTH_TIMING] user lookup: ${(tLookup - t0).toFixed(1)}ms`);

        if (!user) return null;

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        const tBcrypt = debugTiming ? performance.now() : 0;
        if (debugTiming) console.log(`[AUTH_TIMING] bcrypt.compare: ${(tBcrypt - tLookup).toFixed(1)}ms`);
        if (!passwordMatch) return null;

        // Update lastLoginAt
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        const tUpdate = debugTiming ? performance.now() : 0;
        if (debugTiming) {
          console.log(`[AUTH_TIMING] lastLoginAt update: ${(tUpdate - tBcrypt).toFixed(1)}ms`);
          console.log(`[AUTH_TIMING] authorize() total: ${(tUpdate - t0).toFixed(1)}ms`);
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          studentId: user.student?.id,
          enrollmentNumber: user.student?.enrollmentNumber,
          onboardingStep: user.student?.onboardingStep,
        };
      },
    }),
  ],
});
