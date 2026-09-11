/**
 * Student Applications Page — Phase 3
 * Features:
 * - List of all student applications
 * - Status filtering and search
 * - Journey tracker for each application
 * - Application management (view details, withdraw)
 */

import { Suspense } from "react";
import { MyApplicationsContent } from "@/components/student/my-applications-content";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export const dynamic = "force-dynamic";
export const metadata = { 
  title: "My Applications | IIST Career Portal",
  description: "Track your placement applications and view their progress."
};

export default function MyApplicationsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Applications"
        description="Track the progress of your placement applications and view detailed journey timelines."
      />

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        }
      >
        <MyApplicationsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}