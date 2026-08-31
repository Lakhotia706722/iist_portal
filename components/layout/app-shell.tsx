import { Sidebar, type NavGroup } from "./sidebar";
import { Topbar } from "./topbar";

interface AppShellProps {
  navGroups: NavGroup[];
  userName: string;
  userRole: string;
  userEmail: string;
  children: React.ReactNode;
}

export function AppShell({
  navGroups,
  userName,
  userRole,
  userEmail,
  children,
}: AppShellProps) {
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
