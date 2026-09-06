"use client";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import {
  STUDENT_NAV,
  ADMIN_NAV,
  FACULTY_NAV,
  HOD_NAV,
  COMPANY_NAV,
} from "./nav-config";
import type { NavGroup } from "./sidebar";

// NavGroups are resolved client-side from the role string so we never
// serialize LucideIcon function references across the server/client boundary.
function getNavGroups(role: string): NavGroup[] {
  switch (role) {
    case "TP_ADMIN":    return ADMIN_NAV;
    case "FACULTY":     return FACULTY_NAV;
    case "HOD":         return HOD_NAV;
    case "COMPANY_REP": return COMPANY_NAV;
    default:            return STUDENT_NAV;
  }
}

interface AppShellProps {
  role: string;
  userName: string;
  userRole: string;
  userEmail: string;
  children: React.ReactNode;
}

export function AppShell({
  role,
  userName,
  userRole,
  userEmail,
  children,
}: AppShellProps) {
  const navGroups = getNavGroups(role);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar navGroups={navGroups} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar userName={userName} userRole={userRole} userEmail={userEmail} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
