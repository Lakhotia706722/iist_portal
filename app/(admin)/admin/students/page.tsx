import { PageHeader } from "@/components/shared/page-header";
import { StudentsDirectoryClient } from "@/components/admin/students-directory-client";

export const metadata = { title: "Students" };

export default function AdminStudentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="Every registered student, across every department."
      />
      <StudentsDirectoryClient />
    </div>
  );
}
