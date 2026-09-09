import { PageHeader } from "@/components/shared/page-header";
import { MockInterviewsClient } from "@/components/student/mock-interviews-client";

export const metadata = { title: "Mock Interviews" };

export default function StudentMockInterviewsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Mock Interviews"
        description="Your interview history, scores and interviewer feedback."
      />
      <MockInterviewsClient />
    </div>
  );
}
