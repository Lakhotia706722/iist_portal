import { PageHeader } from "@/components/shared/page-header";
import { CompanyDriveDetailClient } from "@/components/company/company-drive-detail-client";

export default function CompanyDriveDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Drive Detail" description="Applicants and round status for your drive." />
      <CompanyDriveDetailClient driveId={params.id} />
    </div>
  );
}
