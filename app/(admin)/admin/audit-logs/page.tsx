import { PageHeader } from "@/components/shared/page-header";
import { AuditLogClient } from "@/components/admin/audit-log-client";

export const metadata = { title: "Audit Logs" };

export default function AdminAuditLogsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Every state-changing action across the portal, with before/after values."
      />
      <AuditLogClient />
    </div>
  );
}
