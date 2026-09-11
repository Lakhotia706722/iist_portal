import { PageHeader } from "@/components/shared/page-header";
import { SkillsClient } from "@/components/admin/skills-client";

export const metadata = { title: "Skills Catalog" };

export default function AdminSkillsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Skills Catalog"
        description="Skills students can add to their profile — create, edit, or retire entries."
      />
      <SkillsClient />
    </div>
  );
}
