"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { NativeSelect as Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { AlertTriangle, Users, Building2, ClipboardList, Award } from "lucide-react";

// Brand-neutral categorical palette.
const COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];

type CommandCenter = {
  students: { total: number; registered: number; profileComplete: number; eligible: number; restricted: number; placed: number; debarred: number };
  companies: { active: number; upcoming: number; completed: number };
  applications: { total: number; active: number; shortlisted: number; selected: number };
  offers: { total: number; avgCtc: number | null; highestCtc: number | null; placementPercent: number };
  alerts: { incompleteProfiles: number; missingDocuments: number; skillUpFailures: number; attendanceViolations: number; unmetRequirements: number; policyViolations: number };
};

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

function CommandCenterTab() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["command-center"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics/command-center");
      if (!res.ok) throw new Error("Failed to load metrics");
      return res.json() as Promise<CommandCenter>;
    },
  });

  if (isLoading) return <LoadingState text="Loading command center…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  const d = data!;

  const studentPie = [
    { name: "Eligible", value: d.students.eligible },
    { name: "Restricted", value: d.students.restricted },
    { name: "Placed", value: d.students.placed },
    { name: "Debarred", value: d.students.debarred },
  ].filter((x) => x.value > 0);

  const alertBars = [
    { name: "Incomplete profiles", value: d.alerts.incompleteProfiles },
    { name: "Missing documents", value: d.alerts.missingDocuments },
    { name: "SkillUp failures", value: d.alerts.skillUpFailures },
    { name: "Attendance violations", value: d.alerts.attendanceViolations },
    { name: "Policy violations", value: d.alerts.policyViolations },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total students" value={d.students.total} sub={`${d.students.registered} registered`} />
        <StatCard icon={Building2} label="Active companies" value={d.companies.active} sub={`${d.companies.upcoming} upcoming drives`} />
        <StatCard icon={ClipboardList} label="Applications" value={d.applications.total} sub={`${d.applications.active} active`} />
        <StatCard icon={Award} label="Placement %" value={`${d.offers.placementPercent}%`} sub={`avg CTC ${d.offers.avgCtc ?? "—"} LPA`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold">Student compliance breakdown</h3>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={studentPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {studentPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Alerts requiring attention
          </h3>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={alertBars} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill={COLORS[3]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={ClipboardList} label="Shortlisted" value={d.applications.shortlisted} />
        <StatCard icon={Award} label="Selected" value={d.applications.selected} />
        <StatCard icon={Award} label="Highest CTC" value={d.offers.highestCtc != null ? `${d.offers.highestCtc} LPA` : "—"} />
      </div>
    </div>
  );
}

type DeptAnalytics = {
  totalStudents: number;
  registrationRate: number;
  applicationRate: number;
  skillUpAveragePercent: number | null;
  interviewAverageScore: number | null;
  placementRate: number;
  avgPackage: number | null;
  medianPackage: number | null;
  highestPackage: number | null;
  companyCount: number;
  offerCount: number;
};

function DepartmentTab() {
  const [departmentId, setDepartmentId] = useState("");
  const [batchId, setBatchId] = useState("");

  const depsQuery = useQuery({
    queryKey: ["departments-for-analytics"],
    queryFn: async () => {
      const res = await fetch("/api/admin/departments");
      if (!res.ok) return { departments: [] };
      const body = await res.json();
      return { departments: Array.isArray(body) ? body : (body.departments ?? body.items ?? []) };
    },
  });

  const batchesQuery = useQuery({
    queryKey: ["batches-for-analytics"],
    queryFn: async () => {
      const res = await fetch("/api/admin/batches");
      if (!res.ok) return { batches: [] };
      const body = await res.json();
      return { batches: Array.isArray(body) ? body : (body.batches ?? body.items ?? []) };
    },
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dept-analytics", departmentId, batchId],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (departmentId) qs.set("departmentId", departmentId);
      if (batchId) qs.set("batchId", batchId);
      const res = await fetch(`/api/admin/analytics/department?${qs}`);
      if (!res.ok) throw new Error("Failed to load analytics");
      return res.json() as Promise<{ analytics: DeptAnalytics; breakdown: Array<{ departmentId: string; departmentName: string; totalStudents: number; placed: number; placementRate: number }> }>;
    },
  });

  if (isLoading) return <LoadingState text="Loading department analytics…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  const a = data!.analytics;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Select aria-label="Filter by department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="w-56">
          <option value="">All departments</option>
          {(depsQuery.data?.departments ?? []).map((d: any) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </Select>
        <Select aria-label="Filter by batch" value={batchId} onChange={(e) => setBatchId(e.target.value)} className="w-56">
          <option value="">All batches</option>
          {(batchesQuery.data?.batches ?? []).map((b: any) => (
            <option key={b.id} value={b.id}>{b.name} ({b.academicYear})</option>
          ))}
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Students in scope" value={a.totalStudents} />
        <StatCard icon={ClipboardList} label="Registration rate" value={`${a.registrationRate}%`} />
        <StatCard icon={ClipboardList} label="Application rate" value={`${a.applicationRate}%`} />
        <StatCard icon={Award} label="Placement rate" value={`${a.placementRate}%`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Award} label="Avg package" value={a.avgPackage != null ? `${a.avgPackage} LPA` : "—"} />
        <StatCard icon={Award} label="Median package" value={a.medianPackage != null ? `${a.medianPackage} LPA` : "—"} />
        <StatCard icon={Award} label="Highest package" value={a.highestPackage != null ? `${a.highestPackage} LPA` : "—"} />
        <StatCard icon={Building2} label="Companies" value={a.companyCount} sub={`${a.offerCount} offers`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard icon={ClipboardList} label="SkillUp average" value={a.skillUpAveragePercent != null ? `${a.skillUpAveragePercent}%` : "No data"} />
        <StatCard icon={ClipboardList} label="Interview average" value={a.interviewAverageScore != null ? `${a.interviewAverageScore}/10` : "No data"} />
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold">Placement rate by department</h3>
        <div className="mt-2 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data!.breakdown}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="departmentName" tick={{ fontSize: 12 }} />
              <YAxis unit="%" />
              <Tooltip />
              <Bar dataKey="placementRate" name="Placement %" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

type CompanySummary = { id: string; name: string; driveCount: number; offerCount: number; avgCtc: number | null };
type CompanyYear = { academicYear: string; driveCount: number; applicantCount: number; selectedCount: number; offerCount: number; avgCtc: number | null };

function CompanyTab() {
  const [companyId, setCompanyId] = useState("");

  const companiesQuery = useQuery({
    queryKey: ["company-summaries"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics/companies");
      if (!res.ok) throw new Error("Failed to load companies");
      return res.json() as Promise<{ companies: CompanySummary[] }>;
    },
  });

  const historyQuery = useQuery({
    queryKey: ["company-history", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const res = await fetch(`/api/admin/analytics/companies/${companyId}/history`);
      if (!res.ok) throw new Error("Failed to load history");
      return res.json() as Promise<{ history: CompanyYear[] }>;
    },
  });

  const companies = useMemo(() => companiesQuery.data?.companies ?? [], [companiesQuery.data]);
  const selected = useMemo(() => companies.find((c) => c.id === companyId), [companies, companyId]);

  if (companiesQuery.isLoading) return <LoadingState text="Loading companies…" />;
  if (companiesQuery.isError) return <ErrorState onRetry={() => companiesQuery.refetch()} />;

  return (
    <div className="space-y-6">
      <Select aria-label="Select company" value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="w-72">
        <option value="">Choose a company…</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>{c.name} ({c.driveCount} drives)</option>
        ))}
      </Select>

      {!companyId ? (
        <Card className="p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2">Company</th>
                  <th className="pb-2">Drives</th>
                  <th className="pb-2">Offers</th>
                  <th className="pb-2">Avg CTC</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {companies.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2">{c.name}</td>
                    <td className="py-2">{c.driveCount}</td>
                    <td className="py-2">{c.offerCount}</td>
                    <td className="py-2">{c.avgCtc != null ? `${c.avgCtc} LPA` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : historyQuery.isLoading ? (
        <LoadingState text="Loading history…" />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={Building2} label="Drive years" value={historyQuery.data?.history.length ?? 0} />
            <StatCard icon={ClipboardList} label="Total offers" value={selected?.offerCount ?? 0} />
            <StatCard icon={Award} label="Avg CTC (all years)" value={selected?.avgCtc != null ? `${selected.avgCtc} LPA` : "—"} />
          </div>
          <Card className="p-5">
            <h3 className="text-sm font-semibold">CTC trend across drive years</h3>
            <div className="mt-2 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyQuery.data?.history ?? []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="academicYear" tick={{ fontSize: 12 }} />
                  <YAxis unit=" LPA" />
                  <Tooltip />
                  <Line type="monotone" dataKey="avgCtc" name="Avg CTC" stroke={COLORS[0]} strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="text-sm font-semibold">Applicants vs. Selected, by year</h3>
            <div className="mt-2 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={historyQuery.data?.history ?? []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="academicYear" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="applicantCount" name="Applicants" fill={COLORS[4]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="selectedCount" name="Selected" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export function AnalyticsClient() {
  return (
    <Tabs defaultValue="command-center">
      <TabsList>
        <TabsTrigger value="command-center">Command Center</TabsTrigger>
        <TabsTrigger value="department">Department / Batch</TabsTrigger>
        <TabsTrigger value="company">Company Performance</TabsTrigger>
      </TabsList>
      <TabsContent value="command-center" className="pt-4"><CommandCenterTab /></TabsContent>
      <TabsContent value="department" className="pt-4"><DepartmentTab /></TabsContent>
      <TabsContent value="company" className="pt-4"><CompanyTab /></TabsContent>
    </Tabs>
  );
}
