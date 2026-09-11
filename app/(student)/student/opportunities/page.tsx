/**
 * Student Opportunities Listing Page — Phase 3
 * Features:
 * - Countdown timers for application deadlines
 * - Eligibility badges for job roles
 * - Filtering by industry, work mode, search
 * - Real-time status updates (active/closing_soon/closed)
 */

import { Suspense } from "react";
import { OpportunitiesContent } from "@/components/student/opportunities-content";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export const dynamic = "force-dynamic";
export const metadata = { 
  title: "Opportunities | IIST Career Portal",
  description: "Browse available placement opportunities and job roles."
};

export default function OpportunitiesPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Placement Opportunities"
        description="Explore open job opportunities from our partnered companies. Apply before the deadlines to secure your future!"
      />

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        }
      >
        <OpportunitiesContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}