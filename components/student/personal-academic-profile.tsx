"use client";

import { useEffect, useState, useCallback } from "react";
import { PersonalInfoForm } from "@/components/onboarding/personal-info-form";
import { AcademicInfoForm } from "@/components/onboarding/academic-info-form";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Tab = "personal" | "academic";

/**
 * Phase 12 — the "Personal & Academic" nav entry had no page at all. Both
 * forms it needs already exist (built for onboarding, Phase 2) and their
 * save endpoints are safe to call again after onboarding completes
 * (savePersonalInfo/saveAcademicInfo both do `Math.max(old.onboardingStep, ...)`,
 * never regressing it) — this is a real edit surface, not a new wizard,
 * reusing both forms and both endpoints as-is.
 */
export function PersonalAcademicProfile() {
  const [tab, setTab] = useState<Tab>("personal");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { toast } = useToast();

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/students/profile");
      if (!res.ok) throw new Error("Failed to load profile");
      const data = await res.json();
      setProfile(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  if (loading) return <LoadingState text="Loading your profile…" />;
  if (error || !profile) return <ErrorState onRetry={fetchProfile} />;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
        {(["personal", "academic"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "personal" ? "Personal Info" : "Academic Info"}
          </button>
        ))}
      </div>

      {tab === "personal" ? (
        <PersonalInfoForm
          defaultValues={profile}
          submitLabel="Save Changes"
          onSuccess={() => {
            toast({ title: "Saved", description: "Your personal information was updated.", variant: "success" });
            fetchProfile();
          }}
        />
      ) : (
        <AcademicInfoForm
          defaultValues={profile.academicRecord}
          onBack={() => setTab("personal")}
          submitLabel="Save Changes"
          onSuccess={() => {
            toast({ title: "Saved", description: "Your academic information was updated.", variant: "success" });
            fetchProfile();
          }}
        />
      )}
    </div>
  );
}
