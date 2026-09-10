import { PageHeader } from "@/components/shared/page-header";
import { FacultyDrivesClient } from "@/components/faculty/faculty-drives-client";

export const metadata = { title: "Drives" };

export default function FacultyDrivesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Placement Drives" description="All active and past drives (read-only)." />
      <FacultyDrivesClient />
    </div>
  );
}
