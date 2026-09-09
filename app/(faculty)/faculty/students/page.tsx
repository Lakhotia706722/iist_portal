import { PageHeader } from "@/components/shared/page-header";
import { FacultyStudentsClient } from "@/components/faculty/faculty-students-client";

export default function FacultyStudentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Assigned Students"
        description="Students in your scope — SkillUp performance and mock interview history (read-only)."
      />
      <FacultyStudentsClient />
    </div>
  );
}
