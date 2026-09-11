import { PageHeader } from "@/components/shared/page-header";
import { ComplianceView } from "@/components/shared/compliance-view";
import { IncidentsClient } from "@/components/admin/incidents-client";

export const metadata = { title: "Student Compliance" };

export default function AdminStudentCompliancePage({
  params,
}: {
  params: { studentId: string };
}) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Student Compliance"
        description="Derived placement eligibility status and discipline history for this student."
      />
      <ComplianceView
        endpoint={`/api/admin/compliance/${params.studentId}`}
        studentId={params.studentId}
        adminControls
      />
      <div>
        <h2 className="mb-3 text-lg font-semibold">Incidents</h2>
        <IncidentsClient studentId={params.studentId} />
      </div>
    </div>
  );
}
