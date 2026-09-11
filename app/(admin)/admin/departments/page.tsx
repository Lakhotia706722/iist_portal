import { DepartmentsClient } from "@/components/admin/departments-client";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Departments" };

export default function DepartmentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Manage academic departments."
      />
      <DepartmentsClient />
    </div>
  );
}
