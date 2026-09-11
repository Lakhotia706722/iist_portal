import { PageHeader } from "@/components/shared/page-header";
import { HodComplianceClient } from "@/components/hod/hod-compliance-client";

export default function HodCompliancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Department Compliance"
        description="Discipline and compliance status for your department's students. Read-only — overrides remain a T&P admin action."
      />
      <HodComplianceClient />
    </div>
  );
}
