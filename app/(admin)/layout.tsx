import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "TP_ADMIN") redirect("/unauthorized");

  return (
    <AppShell
      role={session.user.role}
      userName={session.user.name ?? "Admin"}
      userRole={session.user.role}
      userEmail={session.user.email ?? ""}
    >
      {children}
    </AppShell>
  );
}
