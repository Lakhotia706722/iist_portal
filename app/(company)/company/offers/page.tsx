import { PageHeader } from "@/components/shared/page-header";
import { CompanyOffersClient } from "@/components/company/company-offers-client";

export default function CompanyOffersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Offers" description="Offers tied to your company's drives." />
      <CompanyOffersClient />
    </div>
  );
}
