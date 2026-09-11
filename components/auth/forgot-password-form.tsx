"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { CheckCircle2 } from "lucide-react";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState("");

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) as any });

  async function onSubmit(data: ForgotPasswordInput) {
    setServerError("");
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    // Always show success to prevent email enumeration
    if (res.ok || res.status === 404) { setSent(true); return; }
    setServerError("Something went wrong. Please try again.");
  }

  if (sent) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>
        <h2 className="font-semibold">Check your email</h2>
        <p className="text-sm text-muted-foreground">
          If an account with that email exists, a password reset link has been sent.
          The link expires in 60 minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField label="Email Address" required error={errors.email?.message} htmlFor="email">
        <Input id="email" type="email" placeholder="your@email.com" autoFocus {...register("email")} />
      </FormField>
      {serverError && (
        <p className="text-sm text-destructive" role="alert">{serverError}</p>
      )}
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Send Reset Link
      </Button>
    </form>
  );
}
