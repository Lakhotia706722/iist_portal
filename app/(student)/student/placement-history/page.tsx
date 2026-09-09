import { PageHeader } from "@/components/shared/page-header";
import { PlacementHistoryClient } from "@/components/student/placement-history-client";

export const metadata = { title: "Placement History" };

export default function PlacementHistoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Placement History"
        description="Offers you have received, and where each one currently stands."
      />
      <PlacementHistoryClient />
    </div>
  );
}
