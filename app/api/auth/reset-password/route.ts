import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validations/auth";
import bcrypt from "bcryptjs";
import { writeAuditLog } from "@/server/services/audit.service";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limit = checkRateLimit(req, { bucket: "reset-password", limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return rateLimitedResponse(limit);

  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success)
      return Response.json({ error: "Invalid input" }, { status: 422 });

    const { token, password } = parsed.data;

    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.usedAt || record.expiresAt < new Date())
      return Response.json({ error: "Invalid or expired token" }, { status: 400 });

    const hash = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: hash, mustChangePassword: false },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await writeAuditLog({
      userId: record.userId,
      action: "PASSWORD_RESET",
      entity: "User",
      entityId: record.userId,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[reset-password]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
