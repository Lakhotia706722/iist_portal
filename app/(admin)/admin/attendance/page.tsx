import { PageHeader } from "@/components/shared/page-header";
import { AttendanceOverviewClient } from "@/components/admin/attendance-overview-client";

export const metadata = { title: "Attendance" };

export default function AdminAttendancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Every placement round across every drive, with a marked/present summary."
      />
      <AttendanceOverviewClient driveLinkBase="/admin/drives" />
    </div>
  );
}
