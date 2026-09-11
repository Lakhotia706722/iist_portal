import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { FACULTY_NAV } from "@/components/layout/nav-config";

export default async function FacultyLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["FACULTY", "HOD"].includes(session.user.role)) redirect("/unauthorized");

  return (
    <AppShell
      role={session.user.role}
      userName={session.user.name ?? "Faculty"}
      userRole={session.user.role}
      userEmail={session.user.email ?? ""}
    >
      {children}
    </AppShell>
  );
}
