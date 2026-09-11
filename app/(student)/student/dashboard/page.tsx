import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Briefcase, ClipboardList, Award, UserCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function StudentDashboard() {
  const session = await auth();
  const student = await prisma.student.findUnique({
    where: { userId: session!.user.id },
    include: { branch: true, batch: true },
  });

  const isProfileComplete = (student?.onboardingStep ?? 0) >= 2;

  /**
   * Phase 13 — every stat and "recent" section on this page used to be a
   * hardcoded "—" and a literal "Available from Phase 2 onwards." string,
   * regardless of how much real data existed. Same where-clause
   * listActiveOpportunities() (drive.service.ts) uses for "currently open,
   * not yet closed" so this number matches what the Opportunities page
   * itself would show.
   */
  const activeOpportunitiesWhere = {
    status: "APPLICATIONS_OPEN" as const,
    company: { isActive: true },
    // A drive with no close date set is still open — see the matching
    // comment in listActiveOpportunities() (drive.service.ts).
    OR: [{ applicationCloseAt: null }, { applicationCloseAt: { gt: new Date() } }],
  };

  const [activeOpportunitiesCount, applicationCount, offerCount, recentOpportunities, recentApplications] = student
    ? await Promise.all([
        prisma.placementDrive.count({ where: activeOpportunitiesWhere }),
        prisma.application.count({ where: { studentId: student.id } }),
        prisma.offer.count({ where: { studentId: student.id } }),
        prisma.placementDrive.findMany({
          where: activeOpportunitiesWhere,
          select: { id: true, title: true, company: { select: { name: true } }, applicationCloseAt: true },
          orderBy: { applicationCloseAt: "asc" },
          take: 3,
        }),
        prisma.application.findMany({
          where: { studentId: student.id },
          select: {
            id: true, status: true, appliedAt: true,
            jobRole: { select: { title: true, drive: { select: { company: { select: { name: true } } } } } },
          },
          orderBy: { appliedAt: "desc" },
          take: 3,
        }),
      ])
    : [0, 0, 0, [], []];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${session!.user.name?.split(" ")[0]}!`}
        description="Here's an overview of your placement journey."
      />

      {!isProfileComplete && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-amber-800">Complete your profile</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Your profile is incomplete. Complete it to become eligible for placements.
            </p>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link href="/onboarding">Complete Profile</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active Opportunities", value: activeOpportunitiesCount, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Applications Submitted", value: applicationCount, icon: ClipboardList, color: "text-violet-600", bg: "bg-violet-50" },
          { label: "Offers Received", value: offerCount, icon: Award, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Profile Status", value: isProfileComplete ? "Complete" : "Incomplete", icon: UserCheck, color: isProfileComplete ? "text-emerald-600" : "text-amber-600", bg: isProfileComplete ? "bg-emerald-50" : "bg-amber-50" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {student && (
        <Card>
          <CardHeader><CardTitle>Academic Details</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              {[
                { label: "Enrollment No.", value: student.enrollmentNumber },
                { label: "Branch", value: student.branch.name },
                { label: "Batch", value: student.batch.academicYear },
                { label: "Profile Status", value: <Badge variant={isProfileComplete ? "success" : "warning"}>{isProfileComplete ? "Complete" : "Incomplete"}</Badge> },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-muted-foreground">{item.label}</dt>
                  <dd className="font-medium mt-0.5">{item.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Opportunities</CardTitle></CardHeader>
          <CardContent>
            {recentOpportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No open opportunities right now — check back soon.</p>
            ) : (
              <div className="space-y-2">
                {recentOpportunities.map((o) => (
                  <Link key={o.id} href="/student/opportunities" className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{o.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{o.company.name}</p>
                    </div>
                    {o.applicationCloseAt && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        closes {new Date(o.applicationCloseAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">My Applications</CardTitle></CardHeader>
          <CardContent>
            {recentApplications.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">You haven&apos;t applied to anything yet.</p>
            ) : (
              <div className="space-y-2">
                {recentApplications.map((a) => (
                  <Link key={a.id} href="/student/applications" className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{a.jobRole.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.jobRole.drive.company.name}</p>
                    </div>
                    <StatusBadge status={a.status} className="shrink-0 text-xs" />
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
