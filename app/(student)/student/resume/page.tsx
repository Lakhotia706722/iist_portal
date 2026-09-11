import { PageHeader } from "@/components/shared/page-header";
import { ResumeCenterClient } from "@/components/student/resume-center-client";

export const metadata = { title: "Resume Center" };

export default function ResumePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Resume Center"
        description="Upload resumes, generate from your profile, and keep full version history."
      />
      <ResumeCenterClient />
    </div>
  );
}
