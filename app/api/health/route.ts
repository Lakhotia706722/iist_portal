/**
 * Health check — Phase 16, P7.2. No auth required (an uptime monitor
 * can't log in) — deliberately reveals nothing beyond up/down per
 * dependency. See LAUNCH_CHECKLIST.md for the recommended external
 * uptime-monitor setup against this endpoint.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStorageAdapter } from "@/lib/storage";

// A GET route handler with no dynamic API usage is eligible for Next.js's
// build-time static caching — confirmed the hard way: without this, a
// production build served the SAME cached "ok" response (with the
// timestamp frozen at server start) forever, never actually re-checking
// DB/storage. A health check that can't detect an outage is worse than
// no health check — it actively lies.
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  try {
    // exists() on a near-certainly-absent key is cheap and doesn't
    // require a real object to already be in the bucket.
    await getStorageAdapter().exists("__health-check__");
    checks.storage = "ok";
  } catch {
    checks.storage = "error";
  }

  const healthy = Object.values(checks).every((v) => v === "ok");
  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks, timestamp: new Date().toISOString() },
    { status: healthy ? 200 : 503 }
  );
}
