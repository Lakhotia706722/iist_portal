import { PageHeader } from "@/components/shared/page-header";
import { HodApplicationsClient } from "@/components/hod/hod-applications-client";

export const metadata = { title: "Applications" };

export default function HodApplicationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        description="Every application from your department's students, across every drive."
      />
      <HodApplicationsClient />
    </div>
  );
}
