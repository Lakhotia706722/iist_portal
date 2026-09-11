"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { fetchJson } from "@/lib/api-client";
import { drivesListResponseSchema } from "@/lib/validations/responses";
import { Search, Briefcase } from "lucide-react";

/**
 * Phase 12 — Faculty's "Drives" nav item. Faculty holds `drive:read` (no
 * write permissions on drives at all), so this is a plain read-only list —
 * no create/edit/publish actions, which live on the admin-only drive
 * detail page faculty can't reach anyway (middleware gates /admin/* to
 * TP_ADMIN).
 */
export function FacultyDrivesClient() {
  const [search, setSearch] = useState("");

  // Live — Phase 15: admin publishing/updating a drive. Slower interval —
  // drives change far less often than an applicant list.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["faculty-drives", search],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "100" });
      if (search) p.set("search", search);
      return fetchJson(`/api/admin/drives?${p}`, drivesListResponseSchema);
    },
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });
  const drives = data?.drives ?? [];

  if (isLoading) return <LoadingState text="Loading drives…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search drives" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search drives" />
      </div>

      {drives.length === 0 ? (
        <EmptyState icon={Briefcase} title="No drives found" description="Placement drives will appear here once created." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {drives.map((d) => (
            <Card key={d.id} className="p-4">
              <p className="font-medium">{d.title}</p>
              <p className="text-sm text-muted-foreground">{d.company.name} · {d.academicYear}</p>
              <div className="mt-3 flex items-center justify-between">
                <StatusBadge status={d.status} className="text-xs" />
                <span className="text-xs text-muted-foreground">{d._count.applications} applicant(s) · {d._count.jobRoles} role(s)</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
