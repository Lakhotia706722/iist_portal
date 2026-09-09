import { PageHeader } from "@/components/shared/page-header";
import { SkillUpClient } from "@/components/student/skillup-client";

export const metadata = { title: "SkillUp" };

export default function StudentSkillUpPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="SkillUp"
        description="Your assessment performance, broken down by category."
      />
      <SkillUpClient />
    </div>
  );
}
