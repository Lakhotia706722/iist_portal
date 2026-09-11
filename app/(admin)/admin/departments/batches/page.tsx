import { BatchesClient } from "@/components/admin/batches-client";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Batches" };

export default function BatchesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Batches" description="Manage student batches per branch." />
      <BatchesClient />
    </div>
  );
}
