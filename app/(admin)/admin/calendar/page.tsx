import { PageHeader } from "@/components/shared/page-header";
import { AdminCalendarClient } from "@/components/admin/admin-calendar-client";

export const metadata = { title: "Calendar" };

export default function AdminCalendarPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Placement Calendar"
        description="Every scheduled drive, round, test, interview and deadline."
      />
      <AdminCalendarClient />
    </div>
  );
}
