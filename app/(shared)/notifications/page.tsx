import { PageHeader } from "@/components/shared/page-header";
import { NotificationsClient } from "@/components/shared/notifications-client";

export const metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description="Your notification inbox." />
      <NotificationsClient />
    </div>
  );
}
