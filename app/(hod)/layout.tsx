import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { HOD_NAV } from "@/components/layout/nav-config";

export default async function HodLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "HOD") redirect("/unauthorized");

  return (
    <AppShell
      role={session.user.role}
      userName={session.user.name ?? "HoD"}
      userRole={session.user.role}
      userEmail={session.user.email ?? ""}
    >
      {children}
    </AppShell>
  );
}
