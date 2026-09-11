import { PageHeader } from "@/components/shared/page-header";
import { SkillsClient } from "@/components/student/skills-client";

export const metadata = { title: "Skills" };

export default function SkillsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Skills"
        description="Add programming languages, frameworks, tools and other technical or soft skills."
      />
      <SkillsClient />
    </div>
  );
}
