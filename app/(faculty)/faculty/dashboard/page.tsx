import { PageHeader } from "@/components/shared/page-header";
import { FacultyDashboardClient } from "@/components/faculty/faculty-dashboard-client";
import { auth } from "@/lib/auth/auth";

export default async function FacultyDashboard() {
  const session = await auth();
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${session!.user.name}`}
        description="Your SkillUp tests, mock interviews, and students who need attention."
      />
      <FacultyDashboardClient />
    </div>
  );
}
