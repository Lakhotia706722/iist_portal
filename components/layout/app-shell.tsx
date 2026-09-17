"use client";
import { useState } from "react";
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar
        navGroups={navGroups}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Topbar
          userName={userName}
          userRole={userRole}
          userEmail={userEmail}
          onMenuClick={() => setMobileNavOpen(true)}
        />
        {/* h-dvh (not h-screen/100vh) so the shell matches the actual
            visible viewport on mobile browsers, whose address bar shows
            and hides as you scroll — with 100vh the shell was taller than
            the real visible area, so the true bottom sat under the
            collapsing/expanding browser chrome and took a couple of extra
            scroll gestures to reach. -webkit-overflow-scrolling gives this
            inner scroll region proper momentum/rubber-band scrolling on
            iOS instead of the janky, easy-to-under-scroll default. */}
        <main
          className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 [-webkit-overflow-scrolling:touch]"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
