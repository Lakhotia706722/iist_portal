import { PageHeader } from "@/components/shared/page-header";
import { InternshipsClient } from "@/components/student/internships-client";

export const metadata = { title: "Internships & Experience" };

export default function InternshipsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Internships & Experience"
        description="Add internships, part-time work and any professional experience."
      />
      <InternshipsClient />
    </div>
  );
}
