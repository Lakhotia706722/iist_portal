/**
 * Student Opportunity Detail Page — Phase 3
 * Features:
 * - Complete opportunity details with company info
 * - Eligibility checklist for each job role
 * - Multi-step application flow
 * - Resume selection and confirmation
 */

import { Suspense } from "react";
import { OpportunityDetailContent } from "@/components/student/opportunity-detail-content";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export const dynamic = "force-dynamic";

export default function OpportunityDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="container mx-auto py-6">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        }
      >
        <OpportunityDetailContent opportunityId={params.id} />
      </Suspense>
    </div>
  );
}