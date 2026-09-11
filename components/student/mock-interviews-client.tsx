"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { StatusBadge, formatStatusLabel } from "@/components/shared/status-badge";
import { formatDateTime, cn } from "@/lib/utils";
import { Mic2, MapPin, Video, User } from "lucide-react";

type Result = {
  technicalScore: number | null;
  communicationScore: number | null;
  confidenceScore: number | null;
  problemSolvingScore: number | null;
  hrScore: number | null;
  overallScore: number;
  feedback: string | null;
  strengths: string[];
  weaknesses: string[];
  improvementSuggestions: string[];
};

type Interview = {
  id: string;
  interviewerName: string;
  scheduledAt: string;
  durationMins: number | null;
  targetRole: string | null;
  type: string;
  mode: string;
  venue: string | null;
  meetingLink: string | null;
  status: string;
  result: Result | null;
};

type Summary = {
  total: number;
  completed: number;
  scored: number;
  averages: Record<string, number | null>;
};

const SCORE_LABELS: Array<[keyof Result, string]> = [
  ["technicalScore", "Technical"],
  ["communicationScore", "Communication"],
  ["confidenceScore", "Confidence"],
  ["problemSolvingScore", "Problem solving"],
  ["hrScore", "HR"],
];

function scoreColor(score: number) {
  if (score >= 7.5) return "bg-emerald-500";
  if (score >= 5) return "bg-amber-500";
  return "bg-red-500";
}

export function MockInterviewsClient() {
  // Live — Phase 15: faculty schedule/record results, not this student.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student-interviews"],
    queryFn: async () => {
      const res = await fetch("/api/student/interviews");
      if (!res.ok) throw new Error("Failed to load your interviews");
      return res.json() as Promise<{ interviews: Interview[]; summary: Summary }>;
    },
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  if (isLoading) return <LoadingState text="Loading your interviews…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const { interviews, summary } = data!;

  if (interviews.length === 0) {
    return (
      <EmptyState
        icon={Mic2}
        title="No mock interviews yet"
        description="When the training team schedules a mock interview for you, it appears here along with the interviewer's feedback."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Interviews</p>
          <p className="mt-1 text-2xl font-semibold">{summary.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Completed</p>
          <p className="mt-1 text-2xl font-semibold">{summary.completed}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Average overall</p>
          <p className="mt-1 text-2xl font-semibold">
            {summary.averages.overall != null ? `${summary.averages.overall}/10` : "—"}
          </p>
        </Card>
      </div>

      <div className="space-y-4">
        {interviews.map((i) => (
          <Card key={i.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold">
                  {i.targetRole ?? formatStatusLabel(i.type)}
                </h3>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {i.interviewerName}
                  </span>
                  <span>{formatDateTime(i.scheduledAt)}</span>
                  {i.venue && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {i.venue}
                    </span>
                  )}
                  {i.meetingLink && (
                    <a
                      href={i.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <Video className="h-3.5 w-3.5" />
                      Join link
                    </a>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={i.type} />
                <StatusBadge status={i.status} />
              </div>
            </div>

            {i.result ? (
              <div className="mt-5 space-y-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-muted-foreground">Overall</span>
                  <span className="text-2xl font-semibold tabular-nums">
                    {i.result.overallScore}
                  </span>
                  <span className="text-sm text-muted-foreground">/ 10</span>
                </div>

                <ul className="grid gap-3 sm:grid-cols-2">
                  {SCORE_LABELS.map(([key, label]) => {
                    const v = i.result![key] as number | null;
                    if (v == null) return null;
                    return (
                      <li key={String(key)}>
                        <div className="flex items-baseline justify-between text-sm">
                          <span>{label}</span>
                          <span className="tabular-nums text-muted-foreground">{v}/10</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", scoreColor(v))}
                            style={{ width: `${(v / 10) * 100}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {i.result.feedback && (
                  <div>
                    <h4 className="text-sm font-medium">Feedback</h4>
                    <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                      {i.result.feedback}
                    </p>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-3">
                  <PointList title="Strengths" items={i.result.strengths} tone="positive" />
                  <PointList title="Areas to work on" items={i.result.weaknesses} tone="negative" />
                  <PointList
                    title="Suggestions"
                    items={i.result.improvementSuggestions}
                    tone="neutral"
                  />
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                {i.status === "SCHEDULED"
                  ? "Feedback will appear here once the interview has been assessed."
                  : "No feedback was recorded for this interview."}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function PointList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "negative" | "neutral";
}) {
  if (items.length === 0) return null;
  const dot =
    tone === "positive"
      ? "bg-emerald-500"
      : tone === "negative"
        ? "bg-red-500"
        : "bg-blue-500";
  return (
    <div>
      <h4 className="text-sm font-medium">{title}</h4>
      <ul className="mt-1.5 space-y-1">
        {items.map((item, idx) => (
          <li key={idx} className="flex gap-2 text-sm text-muted-foreground">
            <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
