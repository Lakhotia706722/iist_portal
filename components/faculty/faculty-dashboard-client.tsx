"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { BookOpen, Mic2, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface FacultyDashboard {
  departmentId: string | null;
  tests: Array<{ id: string; title: string; status: string; scheduledAt: string; participantCount: number; completedCount: number }>;
  interviews: Array<{ id: string; studentName: string; scheduledAt: string; status: string; type: string }>;
  needsAttention: Array<{ studentId: string; name: string; enrollmentNumber: string; reason: string }>;
}

export function FacultyDashboardClient() {
  // Live — Phase 15: another faculty/admin's test/interview activity for
  // shared students changes this.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["faculty-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/faculty/dashboard");
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json() as Promise<FacultyDashboard>;
    },
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });

  if (isLoading) return <LoadingState text="Loading dashboard…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  const d = data!;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" /> Your SkillUp tests</CardTitle>
        </CardHeader>
        <CardContent>
          {d.tests.length === 0 ? (
            <EmptyState icon={BookOpen} title="No tests created yet" description="Tests you create will show up here with participation counts." />
          ) : (
            <div className="space-y-2">
              {d.tests.map((t) => (
                <Link key={t.id} href="/faculty/skillup" className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted/50">
                  <div>
                    <p className="font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.completedCount} / {t.participantCount} completed
                    </p>
                  </div>
                  <StatusBadge status={t.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4" /> Needs attention</CardTitle>
        </CardHeader>
        <CardContent>
          {d.needsAttention.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Everyone in scope has a SkillUp result and a mock interview.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {d.needsAttention.map((s) => (
                <li key={s.studentId} className="flex items-center justify-between gap-2">
                  <span>
                    {s.name} <span className="text-xs text-muted-foreground">({s.enrollmentNumber})</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{s.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Mic2 className="h-4 w-4" /> Your mock interviews</CardTitle>
        </CardHeader>
        <CardContent>
          {d.interviews.length === 0 ? (
            <EmptyState icon={Mic2} title="No mock interviews scheduled" />
          ) : (
            <div className="space-y-2">
              {d.interviews.map((iv) => (
                <Link key={iv.id} href="/faculty/mock-interviews" className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted/50">
                  <div>
                    <p className="font-medium">{iv.studentName}</p>
                    <p className="text-xs text-muted-foreground">{iv.type} · {new Date(iv.scheduledAt).toLocaleDateString()}</p>
                  </div>
                  <StatusBadge status={iv.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
