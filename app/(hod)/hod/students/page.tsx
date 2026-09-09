import { PageHeader } from "@/components/shared/page-header";
import { HodStudentsClient } from "@/components/hod/hod-students-client";

export default function HodStudentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Department Students" description="SkillUp performance, applications, and placement results — scoped to your department." />
      <HodStudentsClient />
    </div>
  );
}
