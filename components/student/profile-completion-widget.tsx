"use client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Circle, ChevronDown, ChevronUp, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { ProfileCompletion, CompletionSection } from "@/lib/profile-completion";

const SECTION_LINKS: Record<string, string> = {
  personal_info:    "/student/profile",
  academic_info:    "/student/profile",
  skills:           "/student/profile/skills",
  projects:         "/student/profile/projects",
  internships:      "/student/profile/internships",
  certifications:   "/student/profile/certifications",
  achievements:     "/student/profile/achievements",
  social_profiles:  "/student/profile/social",
  video_profile:    "/student/profile/social",
  resume_uploaded:  "/student/resume",
  documents:        "/student/documents",
};

async function fetchCompletion(): Promise<ProfileCompletion> {
  const res = await fetch("/api/student/profile/completion");
  if (!res.ok) throw new Error("Failed to fetch completion");
  return res.json();
}

export function ProfileCompletionWidget() {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["profile-completion"], queryFn: fetchCompletion });

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="h-4 w-48 rounded bg-muted animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const { score, sections, nextSteps } = data;
  const color = score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  const textColor = score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600";

  // Group sections by group name
  const groups = sections.reduce<Record<string, CompletionSection[]>>((acc, s) => {
    acc[s.group] = [...(acc[s.group] ?? []), s];
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Profile Completion
          </span>
          <span className={`text-2xl font-bold ${textColor}`}>{score}%</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${color}`}
            style={{ width: `${score}%` }}
            role="progressbar"
            aria-valuenow={score}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>

        {/* Next steps */}
        {nextSteps.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-800 mb-2">What to complete next:</p>
            <ul className="space-y-1">
              {nextSteps.map((step, i) => (
                <li key={i} className="text-xs text-amber-700 flex items-center gap-1.5">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-800 text-[10px] font-bold">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Collapsible checklist */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>View full checklist ({sections.filter((s) => s.isComplete).length}/{sections.length} complete)</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expanded && (
          <div className="space-y-4 pt-1">
            {Object.entries(groups).map(([group, items]) => (
              <div key={group}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group}</p>
                <ul className="space-y-1.5">
                  {items.map((s) => (
                    <li key={s.key} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {s.isComplete
                          ? <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                          : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
                        <span className={`text-sm truncate ${s.isComplete ? "text-foreground" : "text-muted-foreground"}`}>
                          {s.label}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`text-xs font-medium ${s.isComplete ? "text-emerald-600" : "text-muted-foreground"}`}>
                          {s.weight}pt
                        </span>
                        {!s.isComplete && (
                          <Link
                            href={SECTION_LINKS[s.key] ?? "#"}
                            className="text-xs text-primary hover:underline whitespace-nowrap"
                          >
                            Complete →
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
