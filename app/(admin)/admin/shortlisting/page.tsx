import { PageHeader } from "@/components/shared/page-header";
import { ShortlistingQueueClient } from "@/components/admin/shortlisting-queue-client";

export const metadata = { title: "Shortlisting" };

export default function AdminShortlistingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Shortlisting"
        description="Applications awaiting a decision, across every drive."
      />
      <ShortlistingQueueClient />
    </div>
  );
}
