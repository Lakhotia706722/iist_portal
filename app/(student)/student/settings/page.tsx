import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";

export const metadata = { title: "Settings" };

/**
 * Phase 13 — this literally said "Account settings will be available in a
 * future update." regardless of the fact that the real change-password
 * flow (app/(shared)/settings/change-password) has existed since early on.
 * Student has its own nav-config Settings entry pointing here (other roles
 * point straight at the shared /settings) — matches that shared page's
 * content rather than duplicating a second, different-looking settings UI.
 */
export default function StudentSettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Settings" description="Manage your account." />
      <Card>
        <CardHeader><CardTitle className="text-base">Security</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Password</p>
            <p className="text-sm text-muted-foreground">
              Change the password used to sign in to the portal.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/student/settings/change-password">
              <KeyRound className="mr-2 h-4 w-4" />
              Change password
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
