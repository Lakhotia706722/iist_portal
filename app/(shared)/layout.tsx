import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";

/**
 * Role-agnostic shell for pages every signed-in user shares (e.g. /settings).
 * Middleware sends forced password changes to /settings/change-password, so
 * this must work for staff roles too — not just students.
 */
export default async function SharedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <AppShell
      role={session.user.role}
      userName={session.user.name ?? "User"}
      userRole={session.user.role}
      userEmail={session.user.email ?? ""}
    >
      {children}
    </AppShell>
  );
}
