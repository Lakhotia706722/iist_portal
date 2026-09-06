import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "STUDENT") redirect("/unauthorized");

  return (
    <AppShell
      role={session.user.role}
      userName={session.user.name ?? "Student"}
      userRole={session.user.role}
      userEmail={session.user.email ?? ""}
    >
      {children}
    </AppShell>
  );
}
