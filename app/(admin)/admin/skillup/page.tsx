import { PageHeader } from "@/components/shared/page-header";
import { AdminSkillUpClient } from "@/components/admin/skillup-client";

export const metadata = { title: "SkillUp" };

export default function AdminSkillUpPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="SkillUp &amp; Assessments"
        description="Create tests, manage categories and publish results."
      />
      <AdminSkillUpClient />
    </div>
  );
}
