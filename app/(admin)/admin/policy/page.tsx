import { PageHeader } from "@/components/shared/page-header";
import { PolicyClient } from "@/components/admin/policy-client";

export const metadata = { title: "Policy Engine" };

export default function AdminPolicyPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Placement Policy"
        description="Institute-wide placement rules, with optional per-batch overrides. Every change is audit-logged."
      />
      <PolicyClient />
    </div>
  );
}
