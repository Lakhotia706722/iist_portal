"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Briefcase, Users, Award } from "lucide-react";

interface CompanyDashboard {
  company: { id: string; name: string; industry: string };
  drives: { active: number; upcoming: number; past: number };
  driveSummaries: Array<{
    id: string;
    title: string;
    status: string;
    academicYear: string;
    applicantCount: number;
    shortlistedCount: number;
    selectedCount: number;
    upcomingRounds: Array<{ id: string; title: string; scheduledAt: string | null }>;
  }>;
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

export function CompanyDashboardClient() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["company-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/company/dashboard");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load dashboard");
      }
      return res.json() as Promise<CompanyDashboard>;
    },
  });

  if (isLoading) return <LoadingState text="Loading your dashboard…" />;
  if (isError)
    return (
      <ErrorState
        title="Couldn't load your dashboard"
        description={(error as Error)?.message ?? "Your account may not be linked to a company yet — contact the placement cell admin."}
        onRetry={() => refetch()}
      />
    );
  const d = data!;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Briefcase} label="Active drives" value={d.drives.active} />
        <StatCard icon={Users} label="Draft / upcoming" value={d.drives.upcoming} />
        <StatCard icon={Award} label="Completed" value={d.drives.past} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your drives</CardTitle>
        </CardHeader>
        <CardContent>
          {d.driveSummaries.length === 0 ? (
            <EmptyState icon={Briefcase} title="No drives yet" description="Drives your company runs will show up here." />
          ) : (
            <div className="space-y-2">
              {d.driveSummaries.map((drive) => (
                <Link
                  key={drive.id}
                  href={`/company/drives/${drive.id}`}
                  className="flex flex-col gap-2 rounded-lg border p-3 text-sm hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{drive.title}</p>
                    <p className="text-xs text-muted-foreground">{drive.academicYear}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{drive.applicantCount} applicants</span>
                    <span>{drive.shortlistedCount} shortlisted</span>
                    <span>{drive.selectedCount} selected</span>
                    <StatusBadge status={drive.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
