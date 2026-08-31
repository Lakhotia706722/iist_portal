import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth/auth";

export default async function FacultyDashboard() {
  const session = await auth();
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${session!.user.name}`}
        description="Faculty placement coordination dashboard."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {["Department Students", "Placement Summary"].map((t) => (
          <Card key={t}>
            <CardHeader><CardTitle className="text-base">{t}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground py-6 text-center">
                Available from Phase 2 onwards.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
