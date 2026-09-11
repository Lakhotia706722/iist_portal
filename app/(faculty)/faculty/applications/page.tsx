import { PageHeader } from "@/components/shared/page-header";
import { AllApplicationsClient } from "@/components/admin/all-applications-client";

export const metadata = { title: "Applications" };

export default function FacultyApplicationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        description="Every application across every drive (read-only)."
      />
      <AllApplicationsClient />
    </div>
  );
}
