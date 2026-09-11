import { PageHeader } from "@/components/shared/page-header";
import { RoundsOverviewClient } from "@/components/admin/rounds-overview-client";

export const metadata = { title: "Rounds" };

export default function AdminRoundsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Rounds"
        description="Every placement round across every drive."
      />
      <RoundsOverviewClient />
    </div>
  );
}
