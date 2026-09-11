import { PageHeader } from "@/components/shared/page-header";
import { EmailTemplatesClient } from "@/components/admin/email-templates-client";

export const metadata = { title: "Notification Templates" };

export default function AdminNotificationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Templates"
        description="Edit the email bodies the portal sends. Placeholders are filled in server-side."
      />
      <EmailTemplatesClient />
    </div>
  );
}
