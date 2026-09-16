"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Users, Target, TrendingUp, Award } from "lucide-react";
import { cn } from "@/lib/utils";

// Mirrors ComprehensiveDriveAnalytics from server/services/drive-dashboard.service.ts —
// the fictional `DashboardData` shape this component was originally written against
// (funnel.totalApplications, byBranch as an array, etc.) was never actually returned
// by any API route, so every render of this tab threw immediately. This type now
// matches what GET /api/admin/drives/[id]/dashboard actually sends.
interface DashboardData {
  funnel: {
    applications: number;
    shortlisted: number;
    inProgress: number;
    selected: number;
  };
  distribution: {
    byBranch: Record<string, { applications: number; shortlisted: number }>;
    byGender: Record<string, { applications: number }>;
    byCgpaBand: Record<string, { applications: number; avgCgpa: number }>;
  };
  jobRoles: {
    byJobRole: Record<string, { title: string; applications: number; shortlisted: number }>;
  };
  timeline: {
    dailyApplications: Array<{ date: string; count: number }>;
  };
}

interface Props { driveId: string }

/* ── tiny bar chart (CSS-only) ──────────────────────────────── */
function BarRow({ label, value, max, sub, cls = "bg-primary" }: {
  label: string; value: number; max: number; sub?: string; cls?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium truncate max-w-[60%]">{label}</span>
        <span className="text-muted-foreground tabular-nums">{value}{sub ? ` / ${sub}` : ""}</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", cls)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ── funnel step ── */
function FunnelStep({ label, value, total, icon: Icon, color }: {
  label: string; value: number; total: number;
  icon: React.ElementType; color: string;
}) {
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
  return (
    <div className="flex items-center gap-4 py-3">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">{label}</span>
          <span className="font-bold tabular-nums">{value}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted mt-1.5 overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{pct}% of total applicants</p>
      </div>
    </div>
  );
}

export function DriveDashboard({ driveId }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchDashboard = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const res = await fetch(`/api/admin/drives/${driveId}/dashboard`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      setData(d.analytics);
    } catch {
      toast({ title: "Error", description: "Failed to load dashboard.", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driveId, toast]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  if (!data) return (
    <div className="text-center py-16 text-muted-foreground">No analytics data available yet.</div>
  );

  const total = data.funnel.applications;
  const byBranch = Object.entries(data.distribution.byBranch).map(([branch, v]) => ({ branch, count: v.applications, shortlisted: v.shortlisted }));
  const byGender = Object.entries(data.distribution.byGender).map(([gender, v]) => ({ gender, count: v.applications }));
  const byJobRole = Object.values(data.jobRoles.byJobRole).map(v => ({ role: v.title, applications: v.applications, shortlisted: v.shortlisted }));
  const cgpaBands = Object.entries(data.distribution.byCgpaBand).filter(([band]) => band !== "No Data");
  const cgpaApplicantCount = cgpaBands.reduce((sum, [, v]) => sum + v.applications, 0);
  const avgCgpa = cgpaApplicantCount > 0
    ? cgpaBands.reduce((sum, [, v]) => sum + v.avgCgpa * v.applications, 0) / cgpaApplicantCount
    : null;
  const applicationTimeline = data.timeline.dailyApplications;
  const maxBranch = Math.max(...byBranch.map(b => b.count), 1);
  const maxRole = Math.max(...byJobRole.map(r => r.applications), 1);
  const maxTimeline = Math.max(...(applicationTimeline.map(t => t.count) ?? [1]), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Drive Analytics</h2>
          <p className="text-sm text-muted-foreground">Live placement drive performance metrics</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchDashboard(true)} disabled={refreshing}>
          <RefreshCw className={cn("h-4 w-4 mr-1.5", refreshing && "animate-spin")} />Refresh
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total Applications", value: total, icon: Users, bg: "bg-blue-50 text-blue-600" },
          { label: "Shortlisted",        value: data.funnel.shortlisted, icon: Target, bg: "bg-green-50 text-green-600" },
          { label: "Selected",           value: data.funnel.selected,    icon: Award, bg: "bg-violet-50 text-violet-600" },
          { label: "Avg CGPA",           value: avgCgpa?.toFixed(2) ?? "—", icon: TrendingUp, bg: "bg-amber-50 text-amber-600" },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{kpi.label}</p>
                <p className="text-2xl font-bold mt-1">{kpi.value}</p>
              </div>
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", kpi.bg)}>
                <kpi.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Application Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Application Funnel</CardTitle>
            <CardDescription>Conversion at each stage</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <FunnelStep label="Total Applied"     value={total}                        total={total} icon={Users}      color="bg-blue-50 text-blue-600" />
            <FunnelStep label="Shortlisted"       value={data.funnel.shortlisted}      total={total} icon={Target}     color="bg-green-50 text-green-600" />
            <FunnelStep label="In Rounds"         value={data.funnel.inProgress}       total={total} icon={TrendingUp} color="bg-amber-50 text-amber-600" />
            <FunnelStep label="Selected"          value={data.funnel.selected}         total={total} icon={Award}      color="bg-violet-50 text-violet-600" />
          </CardContent>
        </Card>

        {/* Branch Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Branch Distribution</CardTitle>
            <CardDescription>Applications &amp; shortlists per branch</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {byBranch.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No data yet.</p>
            ) : byBranch.map(b => (
              <div key={b.branch} className="space-y-1">
                <BarRow label={b.branch} value={b.count} max={maxBranch} cls="bg-blue-500" />
                {b.shortlisted > 0 && (
                  <div className="pl-4">
                    <BarRow label="shortlisted" value={b.shortlisted} max={maxBranch} cls="bg-green-400" />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Gender Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gender Distribution</CardTitle>
            <CardDescription>Applicant gender breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {byGender.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No data yet.</p>
            ) : (
              <div className="space-y-4">
                {(() => {
                  const gTotal = byGender.reduce((s, g) => s + g.count, 0);
                  return byGender.map(g => (
                    <BarRow key={g.gender} label={g.gender} value={g.count} max={gTotal}
                      sub={`${((g.count / gTotal) * 100).toFixed(1)}%`}
                      cls={g.gender === "MALE" ? "bg-blue-500" : g.gender === "FEMALE" ? "bg-pink-500" : "bg-gray-400"} />
                  ));
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per Role */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Job Role</CardTitle>
            <CardDescription>Applications vs shortlisted per role</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {byJobRole.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No data yet.</p>
            ) : byJobRole.map(r => (
              <div key={r.role} className="space-y-1">
                <BarRow label={r.role} value={r.applications} max={maxRole} cls="bg-primary/70" />
                {r.shortlisted > 0 && (
                  <div className="pl-4">
                    <BarRow label="shortlisted" value={r.shortlisted} max={maxRole} cls="bg-green-400" />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Application Timeline */}
      {applicationTimeline && applicationTimeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Application Timeline</CardTitle>
            <CardDescription>Daily submission counts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-28 items-stretch gap-1 overflow-x-auto pb-1">
              {applicationTimeline.map(t => {
                const pct = Math.round((t.count / maxTimeline) * 100);
                return (
                  <div key={t.date} className="flex h-full flex-1 min-w-[28px] flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground tabular-nums">{t.count}</span>
                    {/* This wrapper is what gives the bar's height:%  a real
                        pixel height to resolve against — the column itself
                        was sized by its own content (label + bar + date),
                        so a percentage height on the bar directly inside it
                        had nothing definite to measure against and
                        silently collapsed to 0, rendering no bar at all
                        regardless of the count. */}
                    <div className="flex w-full flex-1 items-end">
                      <div className="w-full rounded-t bg-primary/80 transition-all" style={{ height: `${Math.max(pct, 2)}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground -rotate-45 origin-top-left whitespace-nowrap mt-1">
                      {new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
