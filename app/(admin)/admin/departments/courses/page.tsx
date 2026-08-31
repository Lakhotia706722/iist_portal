import { CoursesClient } from "@/components/admin/courses-client";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Courses" };

export default function CoursesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Courses" description="Manage degree programmes." />
      <CoursesClient />
    </div>
  );
}
