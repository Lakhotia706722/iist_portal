"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// The Branches/Courses/Batches admin pages (and their full CRUD APIs) have
// existed since this feature was first built, but nothing in the UI ever
// linked to them — no sidebar entry, no link from the Departments page
// itself — so there was genuinely no way for an admin to reach them despite
// "Add Batch" working perfectly once you're there. This tab bar, styled to
// match the existing TabsList/TabsTrigger look (components/ui/tabs.tsx),
// makes all four already-built pages reachable via ordinary route
// navigation — real routing, not the Radix Tabs primitive (which manages
// same-page panels, not separate pages).
const TABS = [
  { label: "Departments", href: "/admin/departments" },
  { label: "Branches", href: "/admin/departments/branches" },
  { label: "Courses", href: "/admin/departments/courses" },
  { label: "Batches", href: "/admin/departments/batches" },
];

export default function DepartmentsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div className="inline-flex h-10 max-w-full items-center overflow-x-auto rounded-md bg-muted p-1 text-muted-foreground">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all",
                active ? "bg-background text-foreground shadow-sm" : "hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
