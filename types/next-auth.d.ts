import type { Role } from "@prisma/client";
import type { DefaultSession, DefaultUser } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
      mustChangePassword: boolean;
      studentId?: string;
      enrollmentNumber?: string;
      onboardingStep?: number;
    };
  }

  interface User extends DefaultUser {
    role: Role;
    mustChangePassword: boolean;
    studentId?: string;
    enrollmentNumber?: string;
    onboardingStep?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: Role;
    mustChangePassword: boolean;
    studentId?: string;
    enrollmentNumber?: string;
    onboardingStep?: number;
  }
}
