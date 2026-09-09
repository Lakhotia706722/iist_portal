"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, cn } from "@/lib/utils";
import { BookOpen, ChevronRight, Trophy } from "lucide-react";

type Category = {
  typeId: string;
  name: string;
  slug: string;
  testsTaken: number;
  averagePercentage: number;
  bestPercentage: number;
  passRate: number;
};

type HistoryItem = {
  id: string;
  testId: string;
  title: string;
  category: string;
  scheduledAt: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
  isPassed: boolean;
  rank: number | null;
};

type Performance = {
  overallAverage: number | null;
  testsTaken: number;
  passed: number;
  categories: Category[];
  history: HistoryItem[];
};

function barColor(pct: number) {
  if (pct >= 75) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

export function SkillUpClient() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student-skillup"],
    queryFn: async () => {
      const res = await fetch("/api/student/skillup");
      if (!res.ok) throw new Error("Failed to load your SkillUp performance");
      return res.json() as Promise<Performance>;
    },
  });

  if (isLoading) return <LoadingState text="Loading your performance…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const perf = data!;

  if (perf.testsTaken === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No results yet"
        description="Once the training team publishes results for a test you sat, your performance breakdown appears here."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Headline numbers */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Overall average</p>
          <p className="mt-1 text-2xl font-semibold">
            {perf.overallAverage != null ? `${perf.overallAverage}%` : "—"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Tests taken</p>
          <p className="mt-1 text-2xl font-semibold">{perf.testsTaken}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Passed</p>
          <p className="mt-1 text-2xl font-semibold">
            {perf.passed}
            <span className="ml-1 text-base font-normal text-muted-foreground">
              / {perf.testsTaken}
            </span>
          </p>
        </Card>
      </div>

      {/* Category breakdown */}
      <Card className="p-5">
        <h2 className="text-base font-semibold">Performance by category</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Categories are configured by the training team.
        </p>
        <ul className="mt-4 space-y-4">
          {perf.categories.map((c) => (
            <li key={c.typeId}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm font-medium">{c.name}</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  avg <strong className="text-foreground">{c.averagePercentage}%</strong> · best{" "}
                  {c.bestPercentage}% · {c.testsTaken} test{c.testsTaken === 1 ? "" : "s"}
                </span>
              </div>
              <div
                className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`${c.name} average ${c.averagePercentage} percent`}
              >
                <div
                  className={cn("h-full rounded-full", barColor(c.averagePercentage))}
                  style={{ width: `${Math.min(c.averagePercentage, 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* History */}
      <Card className="p-5">
        <h2 className="text-base font-semibold">Test history</h2>
        <ul className="mt-3 divide-y">
          {perf.history.map((h) => (
            <li key={h.id}>
              <Link
                href={`/student/skillup/${h.testId}`}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-accent/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{h.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {h.category} · {formatDate(h.scheduledAt)}
                    {h.rank ? ` · rank #${h.rank}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {h.marksObtained}/{h.maxMarks}
                  </p>
                  <p className="text-xs text-muted-foreground">{h.percentage}%</p>
                </div>
                <StatusBadge
                  status={h.isPassed ? "PASS" : "FAIL"}
                  label={h.isPassed ? "Passed" : "Not passed"}
                />
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function SkillUpResultDetail({ testId }: { testId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student-skillup", testId],
    queryFn: async () => {
      const res = await fetch(`/api/student/skillup/${testId}`);
      if (!res.ok) throw new Error("Result not found");
      return res.json() as Promise<{ result: any }>;
    },
  });

  if (isLoading) return <LoadingState text="Loading result…" />;
  if (isError) return <ErrorState title="Result unavailable" onRetry={() => refetch()} />;

  const r = data!.result;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{r.test.title}</h2>
            <p className="text-sm text-muted-foreground">
              {r.test.category} · {formatDate(r.test.scheduledAt)}
            </p>
          </div>
          <StatusBadge
            status={r.isPassed ? "PASS" : "FAIL"}
            label={r.isPassed ? "Passed" : "Not passed"}
          />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-4">
          <Stat label="Score" value={`${r.marksObtained}/${r.maxMarks}`} />
          <Stat label="Percentage" value={`${r.percentage}%`} />
          <Stat label="Rank" value={r.rank ? `#${r.rank}` : "—"} />
          <Stat label="Pass mark" value={`${r.test.passingMarks}`} />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Trophy className="h-4 w-4" />
          How the cohort did
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Stat label="Candidates" value={r.cohort.candidates} />
          <Stat
            label="Cohort average"
            value={r.cohort.averagePercentage != null ? `${r.cohort.averagePercentage}%` : "—"}
          />
          <Stat
            label="Top score"
            value={r.cohort.topPercentage != null ? `${r.cohort.topPercentage}%` : "—"}
          />
        </div>
      </Card>

      {r.remarks && (
        <Card className="p-5">
          <h3 className="text-base font-semibold">Examiner remarks</h3>
          <p className="mt-2 text-sm text-muted-foreground">{r.remarks}</p>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
