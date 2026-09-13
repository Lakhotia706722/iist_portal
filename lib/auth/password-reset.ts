/**
 * Shared password-reset-token issuance — extracted from the forgot-password
 * route (Phase 17) so admin-provisioned accounts (P4) can send the same
 * "set your password" email instead of a plaintext temporary password.
 */

import { randomBytes } from "crypto";
import { render } from "@react-email/components";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { PasswordResetEmail } from "@/lib/email/templates/password-reset";

interface IssuePasswordResetTokenOptions {
  /** "reset" (default): existing user asked to reset their password.
   *  "welcome": a newly provisioned account setting its first password. */
  variant?: "reset" | "welcome";
}

export async function issuePasswordResetToken(
  user: { id: string; name: string; email: string },
  options: IssuePasswordResetTokenOptions = {}
): Promise<{ token: string; expiresAt: Date }> {
  const { variant = "reset" } = options;

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
    PasswordResetEmail({ userName: user.name, resetUrl, expiresInMinutes: 60, variant })
  );

  const subject =
    variant === "welcome"
      ? "Set up your IIST Placement Portal account"
      : "Reset your IIST Placement Portal password";
  const text =
    variant === "welcome"
      ? `Welcome to the IIST Placement Portal. Set your password to activate your account: ${resetUrl}\n\nThis link expires in 60 minutes.`
      : `Reset your password: ${resetUrl}\n\nThis link expires in 60 minutes.`;

  await sendEmail({ to: user.email, subject, html, text });

  return { token, expiresAt };
}
