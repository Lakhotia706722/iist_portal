"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<LoginInput>({ resolver: zodResolver(loginSchema) as any });

  async function onSubmit(data: LoginInput) {
    setServerError("");
    // TEMPORARY — CI login-timeout investigation, gated off by default.
    // See matching notes in lib/auth/auth.ts and lib/auth/auth.config.ts.
    const debugTiming = process.env.NEXT_PUBLIC_DEBUG_AUTH_TIMING === "true";
    const t0 = debugTiming ? performance.now() : 0;

    let result: Awaited<ReturnType<typeof signIn>>;
    try {
      result = await signIn("credentials", {
        enrollmentNumber: data.enrollmentNumber,
        password: data.password,
        redirect: false,
      });
    } catch {
      // next-auth's signIn() throws (rather than resolving with
      // result.error) on a response it doesn't recognize as its own — e.g.
      // this app's rate-limiter returning a plain 429 JSON body ahead of
      // NextAuth ever seeing the request. Without this catch, that left the
      // form stuck showing "Sign In" forever with no feedback and no
      // navigation — indistinguishable from a hang.
      setServerError("Too many attempts. Please wait a minute and try again.");
      return;
    }
    if (debugTiming) {
      console.log(`[AUTH_TIMING] client: signIn() round-trip: ${(performance.now() - t0).toFixed(1)}ms`);
    }

    if (result?.error) {
      setServerError("Invalid credentials. Please check your enrollment number and password.");
      return;
    }

    const t1 = debugTiming ? performance.now() : 0;
    router.push(callbackUrl);
    router.refresh();
    if (debugTiming) {
      console.log(`[AUTH_TIMING] client: router.push+refresh issued at +${(t1 - t0).toFixed(1)}ms`);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormField
        label="Enrollment Number / Email"
        required
        error={errors.enrollmentNumber?.message}
        htmlFor="enrollmentNumber"
      >
        <Input
          id="enrollmentNumber"
          placeholder="IIST2021CS01 or staff@iist.ac.in"
          autoComplete="username"
          autoFocus
          {...register("enrollmentNumber")}
        />
      </FormField>

      <FormField label="Password" required error={errors.password?.message} htmlFor="password">
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            autoComplete="current-password"
            className="pr-10"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </FormField>

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-sm text-primary hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      {serverError && (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {serverError}
        </div>
      )}

      <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
        Sign In
      </Button>
    </form>
  );
}
