import { NextRequest } from "next/server";
import { requireAuth, errorResponse } from "@/lib/rbac/server-guard";
import { changePasswordSchema } from "@/lib/validations/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { writeAuditLog } from "@/server/services/audit.service";

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAuth();
    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success)
      return Response.json({ error: "Invalid input" }, { status: 422 });

    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid)
      return Response.json({ error: "Current password is incorrect" }, { status: 400 });

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: actor.id },
      data: { passwordHash: hash, mustChangePassword: false },
    });

    await writeAuditLog({
      userId: actor.id,
      action: "PASSWORD_RESET",
      entity: "User",
      entityId: actor.id,
      metadata: { type: "change_password" },
    });

    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
