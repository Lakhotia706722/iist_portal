import { PageHeader } from "@/components/shared/page-header";
import { CompanyDashboardClient } from "@/components/company/company-dashboard-client";

export default function CompanyDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader title="Company Dashboard" description="Your drives, applicant funnel, and upcoming rounds." />
      <CompanyDashboardClient />
    </div>
  );
}
