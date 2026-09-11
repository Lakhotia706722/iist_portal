import { PageHeader } from "@/components/shared/page-header";
import { AchievementsClient } from "@/components/student/achievements-client";

export const metadata = { title: "Achievements" };

export default function AchievementsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Achievements"
        description="Showcase hackathons, competitions, awards and other accomplishments."
      />
      <AchievementsClient />
    </div>
  );
}
