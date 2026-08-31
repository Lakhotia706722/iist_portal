import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";

export default async function DashboardRedirect() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const routes: Record<string, string> = {
    STUDENT: "/student/dashboard",
    TP_ADMIN: "/admin/dashboard",
    FACULTY: "/faculty/dashboard",
    HOD: "/hod/dashboard",
    COMPANY_REP: "/company/dashboard",
  };
  redirect(routes[session.user.role] ?? "/login");
}
