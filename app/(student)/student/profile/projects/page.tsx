import { PageHeader } from "@/components/shared/page-header";
import { ProjectsClient } from "@/components/student/projects-client";

export const metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Showcase your personal, academic and open-source projects."
      />
      <ProjectsClient />
    </div>
  );
}
