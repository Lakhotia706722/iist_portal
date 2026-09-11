import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { GraduationCap, XCircle } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Reset Password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token;

  // Validate token server-side before rendering form
  let valid = false;
  if (token) {
    const record = await prisma.passwordResetToken.findUnique({
      where: { token },
    });
    valid = !!record && !record.usedAt && record.expiresAt > new Date();
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-muted/30">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <p className="font-bold">IIST Placement Portal</p>
        </div>

        {!valid ? (
          <div className="rounded-xl border bg-card p-6 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="font-semibold">Invalid or expired link</h2>
            <p className="text-sm text-muted-foreground">
              This password reset link is invalid or has expired.
              Please request a new one.
            </p>
            <Link
              href="/forgot-password"
              className="inline-block text-sm font-medium text-primary hover:underline"
            >
              Request new link
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold">Set new password</h1>
              <p className="text-sm text-muted-foreground">
                Choose a strong password for your account.
              </p>
            </div>
            <ResetPasswordForm token={token!} />
          </>
        )}
      </div>
    </div>
  );
}
