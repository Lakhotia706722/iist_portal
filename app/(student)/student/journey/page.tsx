import { PageHeader } from "@/components/shared/page-header";
import { JourneyPage } from "@/components/student/journey-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Journey | IIST Career Portal" };

export default function StudentJourneyPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Placement Journey"
        description="A bird's-eye view of every drive you've applied to and where you stand in each."
      />
      <JourneyPage />
    </div>
  );
}
