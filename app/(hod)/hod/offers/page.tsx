import { PageHeader } from "@/components/shared/page-header";
import { HodOffersClient } from "@/components/hod/hod-offers-client";

export const metadata = { title: "Offers" };

export default function HodOffersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Offers"
        description="Offers made to your department's students."
      />
      <HodOffersClient />
    </div>
  );
}
