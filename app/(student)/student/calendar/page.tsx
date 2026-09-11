import { PageHeader } from "@/components/shared/page-header";
import { CalendarView } from "@/components/shared/calendar-view";

export const metadata = { title: "Calendar" };

export default function StudentCalendarPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Placement Calendar"
        description="Drives, rounds, tests, interviews and deadlines that apply to you."
      />
      <CalendarView
        endpoint="/api/student/calendar"
        emptyDescription="Events relevant to your batch and applications will appear here."
      />
    </div>
  );
}
