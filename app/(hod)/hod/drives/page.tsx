import { PageHeader } from "@/components/shared/page-header";
import { FacultyDrivesClient } from "@/components/faculty/faculty-drives-client";

export const metadata = { title: "Drives" };

/**
 * Phase 12 — HOD's "Drives" nav item had no page at all. HOD holds
 * `drive:read` same as Faculty and the existing component is purely
 * read-only and role-agnostic (no hardcoded `/faculty` or `/admin` links),
 * so it's reused as-is rather than duplicated. Full write-parity with the
 * admin drive-detail page (create/edit/publish, per-drive rounds &
 * shortlisting) is out of this phase's scope — HOD write permissions on
 * drives exist in the RBAC matrix but the admin drive-detail UI is a
 * monolithic component with `/admin`-hardcoded navigation baked into the
 * page itself, not just its tabs; building a parallel HOD version of that
 * is flagged in this phase's report as a scope decision, not built here.
 */
export default function HodDrivesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Drives"
        description="Every placement drive (read-only)."
      />
      <FacultyDrivesClient />
    </div>
  );
}
