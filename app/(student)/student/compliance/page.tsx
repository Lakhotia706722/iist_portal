import { PageHeader } from "@/components/shared/page-header";
import { ComplianceView } from "@/components/shared/compliance-view";

export const metadata = { title: "Compliance Status" };

export default function StudentCompliancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance Status"
        description="Your current placement eligibility status and why it's set that way."
      />
      <ComplianceView endpoint="/api/student/compliance" />
    </div>
  );
}
