import { PageHeader } from "@/components/shared/page-header";
import { UsersRolesClient } from "@/components/admin/users-roles-client";

export const metadata = { title: "Users & Roles" };

export default function AdminUsersRolesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & Roles"
        description="Manage staff accounts — Faculty, HOD, T&P Admin, and Company Rep."
      />
      <UsersRolesClient />
    </div>
  );
}
