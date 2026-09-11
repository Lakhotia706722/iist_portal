import { BranchesClient } from "@/components/admin/branches-client";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Branches" };

export default function BranchesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Branches" description="Manage branches within departments." />
      <BranchesClient />
    </div>
  );
}
