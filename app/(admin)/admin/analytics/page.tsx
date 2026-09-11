import { PageHeader } from "@/components/shared/page-header";
import { AnalyticsClient } from "@/components/admin/analytics-client";

export const metadata = { title: "Analytics" };

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Institute-wide metrics, department/batch performance, and company placement history."
      />
      <AnalyticsClient />
    </div>
  );
}
