import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Manage your account." />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Password</p>
            <p className="text-sm text-muted-foreground">
              Change the password used to sign in to the portal.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/settings/change-password">
              <KeyRound className="mr-2 h-4 w-4" />
              Change password
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
