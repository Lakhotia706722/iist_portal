import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { issuePasswordResetToken } from "@/lib/auth/password-reset";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limit = checkRateLimit(req, { bucket: "forgot-password", limit: 5, windowMs: 60_000 });
  if (!limit.allowed) return rateLimitedResponse(limit);

  try {
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success)
      return Response.json({ error: "Invalid email" }, { status: 422 });

    const { email } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return 200 to prevent email enumeration
    if (!user || !user.isActive) return Response.json({ ok: true });

    await issuePasswordResetToken(user);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[forgot-password]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
