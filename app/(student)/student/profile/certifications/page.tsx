import { PageHeader } from "@/components/shared/page-header";
import { CertificationsClient } from "@/components/student/certifications-client";

export const metadata = { title: "Certifications" };

export default function CertificationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Certifications"
        description="Add professional certifications, online courses and licences."
      />
      <CertificationsClient />
    </div>
  );
}
