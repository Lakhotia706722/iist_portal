import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { COMPANY_NAV } from "@/components/layout/nav-config";

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "COMPANY_REP") redirect("/unauthorized");

  return (
    <AppShell
      role={session.user.role}
      userName={session.user.name ?? "Company Rep"}
      userRole={session.user.role}
      userEmail={session.user.email ?? ""}
    >
      {children}
    </AppShell>
  );
}
