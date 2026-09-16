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

/**
 * A random password guaranteed to satisfy passwordStrengthSchema (upper,
 * lower, digit, 8+ chars) — shared by staff account creation
 * (user.service.ts) and, since Phase 18, admin-set student passwords, so
 * there's exactly one "what does a generated password look like" answer.
 */
export function generateStrongPassword(): string {
  return randomBytes(9).toString("base64").replace(/[+/=]/g, "x") + "A1!";
}

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

  // Matches the fallback already used in lib/notifications/index.ts and
  // lib/storage/local-adapter.ts — without it, an unset NEXT_PUBLIC_APP_URL
  // (as in production today; see the Vercel env var checklist) makes this
  // literally the string "undefined/reset-password?token=...", not merely
  // a wrong host.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?token=${token}`;
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
