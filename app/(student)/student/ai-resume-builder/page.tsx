import { PageHeader } from "@/components/shared/page-header";
import { AIResumeBuilderClient } from "@/components/student/ai-resume-builder-client";

export const metadata = { title: "AI Resume Builder" };

export default function AIResumeBuilderPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Resume Builder"
        description="Match your profile against a job description, get skill-gap analysis, and draft tailored resume bullets — all grounded in your verified profile data."
      />
      <AIResumeBuilderClient />
    </div>
  );
}
