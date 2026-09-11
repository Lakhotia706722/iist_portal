import { PrismaClient } from "@prisma/client";

// Legitimate use of `as unknown as` — the standard Next.js/Prisma dev-mode
// singleton pattern (attaching to `globalThis` to survive hot-reload
// without spawning a new connection pool each time). Not a request/response
// shape cast, and there's no "real type" this could be checked against
// instead — `globalThis` genuinely doesn't have a `prisma` property until
// this file adds one.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
