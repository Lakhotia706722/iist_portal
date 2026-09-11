import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  KeyRound, Star, ShieldCheck, Bell, Building, Code2, FolderOpen, CalendarDays, Video,
} from "lucide-react";

export const metadata = { title: "Settings" };

const CONFIG_LINKS = [
  { label: "Profile Visibility", href: "/admin/settings/profile-visibility", icon: Star, description: "Control what students can share publicly." },
  { label: "Policy Rules", href: "/admin/policy", icon: ShieldCheck, description: "Placement eligibility and debarment rules." },
  { label: "Departments & Branches", href: "/admin/departments", icon: Building, description: "Academic structure used across the portal." },
  { label: "Skills Catalog", href: "/admin/skills", icon: Code2, description: "Skills students can add to their profile." },
  { label: "Notifications", href: "/admin/notifications", icon: Bell, description: "Notification templates and delivery settings." },
  { label: "Documents", href: "/admin/documents", icon: FolderOpen, description: "Required document types and verification." },
  { label: "Calendar", href: "/admin/calendar", icon: CalendarDays, description: "Placement season events and deadlines." },
  { label: "Video Profiles", href: "/admin/video-profiles", icon: Video, description: "Student video introduction review." },
];

/**
 * Phase 12 — "Settings" had a directory on disk (only profile-visibility
 * inside it) but no page.tsx of its own, so it genuinely 404'd. This is a
 * hub: account security (same pattern as the shared /settings page every
 * role gets) plus quick links into the portal-configuration pages that
 * already exist elsewhere in the admin nav — not a duplicate settings
 * system, just one place that points at all of them.
 */
export default function AdminSettingsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Account security and portal configuration." />

      <Card>
        <CardHeader><CardTitle className="text-base">Security</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Password</p>
            <p className="text-sm text-muted-foreground">Change the password used to sign in to the portal.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/settings/change-password">
              <KeyRound className="mr-2 h-4 w-4" />
              Change password
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Portal Configuration</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {CONFIG_LINKS.map((c) => (
              <Link key={c.href} href={c.href} className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                <c.icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{c.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
