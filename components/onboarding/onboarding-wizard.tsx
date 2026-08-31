"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, CheckCircle2, User, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { PersonalInfoForm } from "./personal-info-form";
import { AcademicInfoForm } from "./academic-info-form";

interface OnboardingWizardProps {
  initialStep: number;
  student: any;
  enrollmentNumber: string;
  branchName: string;
  batchYear: string;
}

const STEPS = [
  { id: 1, label: "Personal Info", icon: User },
  { id: 2, label: "Academic Info", icon: BookOpen },
];

export function OnboardingWizard({
  initialStep,
  student,
  enrollmentNumber,
  branchName,
  batchYear,
}: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep === 0 ? 1 : initialStep === 1 ? 2 : 1);

  function handlePersonalDone() {
    setStep(2);
  }

  function handleAcademicDone() {
    router.push("/student/dashboard");
    router.refresh();
  }

  return (
    <div className="w-full max-w-3xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <GraduationCap className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold">Complete Your Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {enrollmentNumber} · {branchName} · {batchYear}
        </p>
      </div>

      {/* Step indicators */}
      <div className="mb-8 flex items-center justify-center gap-0">
        {STEPS.map((s, i) => {
          const done = step > s.id;
          const active = step === s.id;
          const Icon = s.icon;
          return (
            <div key={s.id} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                    done
                      ? "border-primary bg-primary text-white"
                      : active
                      ? "border-primary bg-background text-primary"
                      : "border-muted-foreground/30 bg-background text-muted-foreground/50"
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium",
                    active ? "text-foreground" : done ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-3 mb-5 h-0.5 w-20",
                    done ? "bg-primary" : "bg-muted-foreground/20"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Form panels */}
      {step === 1 && (
        <PersonalInfoForm
          defaultValues={student}
          onSuccess={handlePersonalDone}
        />
      )}
      {step === 2 && (
        <AcademicInfoForm
          defaultValues={student.academicRecord}
          onSuccess={handleAcademicDone}
          onBack={() => setStep(1)}
        />
      )}
    </div>
  );
}
