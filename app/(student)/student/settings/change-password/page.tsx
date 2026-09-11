import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Change Password" };

export default function ChangePasswordPage({
  searchParams,
}: {
  searchParams: { forced?: string };
}) {
  const forced = searchParams.forced === "true";
  return (
    <div className="max-w-md space-y-6">
      <PageHeader
        title="Change Password"
        description={forced ? "You must set a new password before continuing." : "Update your account password."}
      />
      {forced && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your account requires a password change before you can access the portal.
        </div>
      )}
      <ChangePasswordForm forced={forced} />
    </div>
  );
}
