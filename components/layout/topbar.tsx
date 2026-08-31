"use client";
import { signOut } from "next-auth/react";
import { Bell, ChevronDown, LogOut, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
import { useState } from "react";
import Link from "next/link";

interface TopbarProps {
  userName: string;
  userRole: string;
  userEmail: string;
}

const ROLE_LABELS: Record<string, string> = {
  STUDENT: "Student",
  TP_ADMIN: "TP Admin",
  FACULTY: "Faculty",
  HOD: "Head of Department",
  COMPANY_REP: "Company Representative",
};

export function Topbar({ userName, userRole, userEmail }: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 gap-4">
      {/* Spacer */}
      <div className="flex-1" />

      {/* Notifications */}
      <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
        <Bell className="h-5 w-5" />
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
      </Button>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent transition-colors"
          aria-expanded={menuOpen}
          aria-haspopup="true"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
            {getInitials(userName)}
          </div>
          <div className="hidden sm:block text-left">
            <p className="font-medium leading-none">{userName}</p>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">
              {ROLE_LABELS[userRole] ?? userRole}
            </p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
              aria-hidden
            />
            <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border bg-popover shadow-lg py-1">
              <div className="px-3 py-2 border-b">
                <p className="text-sm font-medium truncate">{userName}</p>
                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              </div>
              <Link
                href="/settings"
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
              <Link
                href="/settings/change-password"
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                <User className="h-4 w-4" />
                Change Password
              </Link>
              <div className="my-1 border-t" />
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
