import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { GraduationCap, Building2, Briefcase, Users } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "created", UPDATE: "updated", DELETE: "deleted", LOGIN: "logged in",
  LOGOUT: "logged out", PASSWORD_RESET: "reset a password", ROLE_CHANGE: "changed a role",
  STATUS_CHANGE: "changed status of", EXPORT: "exported",
};

export default async function AdminDashboard() {
  /**
   * Phase 13 — "Active Drives" was hardcoded to "—", and both "Recent
   * Activity" and "Upcoming Drives" were literal "Available from Phase 2
   * onwards." text, regardless of real data. All four now come from real
   * queries — matching the pattern the other three stats here already used.
   */
  const [studentCount, deptCount, userCount, activeDriveCount, recentActivity, upcomingDrives] = await Promise.all([
    prisma.student.count(),
    prisma.department.count(),
    prisma.user.count(),
    prisma.placementDrive.count({ where: { status: "APPLICATIONS_OPEN" } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, action: true, entity: true, createdAt: true, user: { select: { name: true } } },
    }),
    prisma.placementDrive.findMany({
      where: { status: { in: ["PUBLISHED", "APPLICATIONS_OPEN"] } },
      orderBy: { applicationCloseAt: "asc" },
      take: 5,
      select: { id: true, title: true, status: true, company: { select: { name: true } }, applicationCloseAt: true },
    }),
  ]);

  const stats = [
    { label: "Total Students", value: studentCount, icon: GraduationCap, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Departments", value: deptCount, icon: Building2, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Active Drives", value: activeDriveCount, icon: Briefcase, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Total Users", value: userCount, icon: Users, color: "text-orange-600", bg: "bg-orange-50" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="Training & Placement Cell — overview and quick actions."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold mt-1">{s.value}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.bg}`}>
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No activity recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((log) => (
                  <div key={log.id} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{log.user?.name ?? "System"}</span>{" "}
                      {ACTION_LABELS[log.action] ?? log.action.toLowerCase()} {log.entity}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Upcoming Drives</CardTitle></CardHeader>
          <CardContent>
            {upcomingDrives.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No published or open drives right now.</p>
            ) : (
              <div className="space-y-2">
                {upcomingDrives.map((d) => (
                  <Link key={d.id} href={`/admin/drives/${d.id}`} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{d.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{d.company.name}</p>
                    </div>
                    <StatusBadge status={d.status} className="shrink-0 text-xs" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
