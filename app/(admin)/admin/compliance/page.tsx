import { PageHeader } from "@/components/shared/page-header";
import { IncidentsClient } from "@/components/admin/incidents-client";

export const metadata = { title: "Compliance" };

export default function AdminCompliancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance &amp; Discipline"
        description="Discipline incidents across all students. Open a student's profile to see their derived compliance status."
      />
      <IncidentsClient />
    </div>
  );
}
