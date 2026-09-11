"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const [serverError, setServerError] = useState("");

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<ResetPasswordInput>({
      resolver: zodResolver(resetPasswordSchema) as any,
      defaultValues: { token },
    });

  async function onSubmit(data: ResetPasswordInput) {
    setServerError("");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setDone(true); return; }
    const body = await res.json();
    setServerError(body?.error ?? "Something went wrong.");
  }

  if (done) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>
        <h2 className="font-semibold">Password updated!</h2>
        <p className="text-sm text-muted-foreground">You can now sign in with your new password.</p>
        <Link href="/login" className="inline-block text-sm font-medium text-primary hover:underline">
          Go to sign in →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...register("token")} />
      <FormField label="New Password" required error={errors.password?.message} htmlFor="pw" hint="Min 8 chars, uppercase, lowercase, number">
        <div className="relative">
          <Input id="pw" type={showPw ? "text" : "password"} className="pr-10" {...register("password")} />
          <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1} aria-label="Toggle password">
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </FormField>
      <FormField label="Confirm Password" required error={errors.confirmPassword?.message} htmlFor="cpw">
        <div className="relative">
          <Input id="cpw" type={showCpw ? "text" : "password"} className="pr-10" {...register("confirmPassword")} />
          <button type="button" onClick={() => setShowCpw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1} aria-label="Toggle password">
            {showCpw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </FormField>
      {serverError && <p className="text-sm text-destructive" role="alert">{serverError}</p>}
      <Button type="submit" className="w-full" loading={isSubmitting}>Set New Password</Button>
    </form>
  );
}
