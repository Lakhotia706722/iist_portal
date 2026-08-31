import { LoginForm } from "@/components/auth/login-form";
import { GraduationCap } from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign In" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-sidebar p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-lg font-bold text-white leading-none">IIST</p>
            <p className="text-xs text-white/60">Placement Portal</p>
          </div>
        </div>
        <div>
          <blockquote className="space-y-2">
            <p className="text-2xl font-semibold text-white leading-snug">
              &ldquo;Your career journey begins here. Every application, every
              opportunity, tracked in one place.&rdquo;
            </p>
            <footer className="text-sm text-white/60">
              Training &amp; Placement Cell, IIST Thiruvananthapuram
            </footer>
          </blockquote>
        </div>
        <p className="text-xs text-white/40">
          Indian Institute of Space Science and Technology
        </p>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-bold leading-none">IIST Placement Portal</p>
              <p className="text-xs text-muted-foreground">Training &amp; Placement Cell</p>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">
              Sign in with your enrollment number or staff email.
            </p>
          </div>

          <LoginForm />

          <p className="text-center text-xs text-muted-foreground">
            Having trouble?{" "}
            <a
              href="mailto:placement@iist.ac.in"
              className="text-primary hover:underline"
            >
              Contact the placement cell
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
