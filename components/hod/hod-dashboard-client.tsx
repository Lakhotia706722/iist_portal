"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { Users, TrendingUp, Award, Building2 } from "lucide-react";

interface HodDashboard {
  department: { id: string; name: string };
  studentCounts: { total: number; registered: number; profileComplete: number; eligible: number; placed: number };
  analytics: {
    placementRate: number;
    avgPackage: number | null;
    medianPackage: number | null;
    highestPackage: number | null;
    companyCount: number;
    offerCount: number;
    skillUpAveragePercent: number | null;
    interviewAverageScore: number | null;
  };
}

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

export function HodDashboardClient() {
  // Live — Phase 15: admin recording an offer/placement in this
  // department changes these counts.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["hod-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/hod/dashboard");
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json() as Promise<HodDashboard>;
    },
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });

  if (isLoading) return <LoadingState text="Loading department dashboard…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  const d = data!;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total students" value={d.studentCounts.total} sub={`${d.studentCounts.registered} registered`} />
        <StatCard icon={TrendingUp} label="Placement rate" value={`${d.analytics.placementRate}%`} sub={`${d.studentCounts.placed} placed`} />
        <StatCard icon={Award} label="Avg / Median package" value={`${d.analytics.avgPackage ?? "—"} LPA`} sub={`median ${d.analytics.medianPackage ?? "—"} LPA`} />
        <StatCard icon={Building2} label="Companies visited" value={d.analytics.companyCount} sub={`${d.analytics.offerCount} offers`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{d.department.name} — overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Profile complete</p>
            <p className="text-lg font-semibold">{d.studentCounts.profileComplete} / {d.studentCounts.total}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Highest package</p>
            <p className="text-lg font-semibold">{d.analytics.highestPackage ?? "—"} LPA</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg SkillUp score</p>
            <p className="text-lg font-semibold">{d.analytics.skillUpAveragePercent != null ? `${d.analytics.skillUpAveragePercent}%` : "—"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
