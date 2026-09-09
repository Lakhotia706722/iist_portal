import { PageHeader } from "@/components/shared/page-header";
import { HodDashboardClient } from "@/components/hod/hod-dashboard-client";
import { auth } from "@/lib/auth/auth";

export default async function HodDashboard() {
  const session = await auth();
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${session!.user.name}`}
        description="Head of Department — placement oversight for your department."
      />
      <HodDashboardClient />
    </div>
  );
}
