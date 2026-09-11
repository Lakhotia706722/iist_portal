"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export function ChangePasswordForm({ forced }: { forced?: boolean }) {
  const router = useRouter();
  const { update } = useSession();
  const [done, setDone] = useState(false);
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [serverError, setServerError] = useState("");

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) as any });

  async function onSubmit(data: ChangePasswordInput) {
    setServerError("");
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setDone(true);
      if (forced) {
        // Same class of bug as academic-info-form.tsx's onboardingStep fix
        // (see the comment on the jwt() callback in auth.config.ts):
        // without patching the token, middleware's mustChangePassword gate
        // still sees the pre-change value and redirects straight back here
        // forever.
        await update({ mustChangePassword: false });
        setTimeout(() => { router.push("/dashboard"); router.refresh(); }, 1500);
      }
      return;
    }
    const body = await res.json();
    setServerError(body?.error ?? "Failed to change password.");
  }

  if (done) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
          <h2 className="font-semibold">Password changed successfully</h2>
          {forced && <p className="text-sm text-muted-foreground">Redirecting you to the dashboard…</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Current Password" required error={errors.currentPassword?.message} htmlFor="curPw">
            <div className="relative">
              <Input id="curPw" type={showCur ? "text" : "password"} className="pr-10" {...register("currentPassword")} />
              <button type="button" onClick={() => setShowCur(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1} aria-label="Toggle">
                {showCur ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>
          <FormField label="New Password" required error={errors.newPassword?.message} htmlFor="newPw" hint="Min 8 chars, uppercase, lowercase, number">
            <div className="relative">
              <Input id="newPw" type={showNew ? "text" : "password"} className="pr-10" {...register("newPassword")} />
              <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1} aria-label="Toggle">
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>
          <FormField label="Confirm New Password" required error={errors.confirmPassword?.message} htmlFor="confPw">
            <Input id="confPw" type="password" {...register("confirmPassword")} />
          </FormField>
          {serverError && <p className="text-sm text-destructive" role="alert">{serverError}</p>}
          <Button type="submit" className="w-full" loading={isSubmitting}>Change Password</Button>
        </form>
      </CardContent>
    </Card>
  );
}
