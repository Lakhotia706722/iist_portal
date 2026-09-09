import { PageHeader } from "@/components/shared/page-header";
import { OffersClient } from "@/components/admin/offers-client";

export const metadata = { title: "Offers" };

export default function AdminOffersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Offers"
        description="Record and track placement offers through acceptance and joining."
      />
      <OffersClient />
    </div>
  );
}
