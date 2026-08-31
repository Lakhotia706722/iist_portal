import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { GraduationCap, Building2, Briefcase, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [studentCount, deptCount, userCount] = await Promise.all([
    prisma.student.count(),
    prisma.department.count(),
    prisma.user.count(),
  ]);

  const stats = [
    { label: "Total Students", value: studentCount, icon: GraduationCap, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Departments", value: deptCount, icon: Building2, color: "text-violet-600", bg: "bg-violet-50" },
    { label: "Active Drives", value: "—", icon: Briefcase, color: "text-emerald-600", bg: "bg-emerald-50" },
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
        {["Recent Activity", "Upcoming Drives"].map((title) => (
          <Card key={title}>
            <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground py-6 text-center">
                Available from Phase 2 onwards.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
