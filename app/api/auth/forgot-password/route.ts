import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { sendEmail } from "@/lib/email";
import { randomBytes } from "crypto";
import { render } from "@react-email/components";
import { PasswordResetEmail } from "@/lib/email/templates/password-reset";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success)
      return Response.json({ error: "Invalid email" }, { status: 422 });

    const { email } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return 200 to prevent email enumeration
    if (!user || !user.isActive) return Response.json({ ok: true });

    // Invalidate previous unused tokens
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;
    const html = await render(
      PasswordResetEmail({ userName: user.name, resetUrl, expiresInMinutes: 60 })
    );

    await sendEmail({
      to: user.email,
      subject: "Reset your IIST Placement Portal password",
      html,
      text: `Reset your password: ${resetUrl}\n\nThis link expires in 60 minutes.`,
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[forgot-password]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
