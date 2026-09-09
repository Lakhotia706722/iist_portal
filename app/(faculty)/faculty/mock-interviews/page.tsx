import { PageHeader } from "@/components/shared/page-header";
import { AdminInterviewsClient } from "@/components/admin/interviews-client";

export const metadata = { title: "Mock Interviews" };

export default function FacultyMockInterviewsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Mock Interviews"
        description="Schedule mock interviews and record feedback."
      />
      <AdminInterviewsClient />
    </div>
  );
}
