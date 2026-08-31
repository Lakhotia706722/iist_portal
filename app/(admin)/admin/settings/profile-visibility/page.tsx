import { PageHeader } from "@/components/shared/page-header";
import { ProfileVisibilityClient } from "@/components/admin/profile-visibility-client";

export const metadata = { title: "Profile Visibility Settings" };

export default function ProfileVisibilityPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile Visibility Settings"
        description="Control which profile sections and fields are visible to companies when viewing student profiles."
      />
      <ProfileVisibilityClient />
    </div>
  );
}
