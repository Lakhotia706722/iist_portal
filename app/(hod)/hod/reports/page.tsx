import { PageHeader } from "@/components/shared/page-header";
import { ReportsClient } from "@/components/admin/reports-client";

export const metadata = { title: "Reports" };

export default function HodReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Export data as CSV, Excel, or PDF." />
      <ReportsClient />
    </div>
  );
}
