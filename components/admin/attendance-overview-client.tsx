"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { fetchJson } from "@/lib/api-client";
import { attendanceOverviewResponseSchema } from "@/lib/validations/responses";
import { Search, ClipboardCheck } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

/**
 * Phase 12 — cross-drive attendance overview. Shared by /admin/attendance
 * and /faculty/attendance (both hold `attendance:read`) — a queue of every
 * round across every drive with a marked/present summary, so staff can see
 * which rounds still need attendance taken without opening each drive one
 * at a time. Marking itself stays on the drive's own Attendance tab
 * (admin-only, since only TP_ADMIN/HOD hold `attendance:write`).
 */
export function AttendanceOverviewClient({ driveLinkBase }: { driveLinkBase?: string } = {}) {
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");

  const fetchRounds = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const p = new URLSearchParams({ limit: "100" });
      if (search) p.set("search", search);
      const data = await fetchJson(`/api/admin/attendance?${p}`, attendanceOverviewResponseSchema);
      setRounds(data.rounds);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchRounds(); }, [fetchRounds]);

  if (loading) return <LoadingState text="Loading rounds…" />;
  if (error) return <ErrorState onRetry={fetchRounds} />;

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search rounds or drives" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search rounds" />
      </div>

      {rounds.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No rounds found" description="Placement rounds will appear here once scheduled." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="p-3 text-left font-medium">Round</th>
                  <th className="p-3 text-left font-medium">Drive</th>
                  <th className="p-3 text-left font-medium">Scheduled</th>
                  <th className="p-3 text-left font-medium">Attendance</th>
                  {driveLinkBase && <th className="p-3 text-left font-medium">Action</th>}
                </tr>
              </thead>
              <tbody>
                {rounds.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/20">
                    <td className="p-3">
                      <p className="font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.type}</p>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {r.drive.title}
                      <div className="text-xs">{r.drive.company.name}</div>
                    </td>
                    <td className="p-3 text-muted-foreground">{r.scheduledAt ? formatDateTime(r.scheduledAt) : "Not scheduled"}</td>
                    <td className="p-3 tabular-nums">
                      {r.markedCount}/{r.participantCount} marked
                      {r.markedCount > 0 && <span className="text-xs text-muted-foreground"> · {r.presentCount} present</span>}
                    </td>
                    {driveLinkBase && (
                      <td className="p-3">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`${driveLinkBase}/${r.drive.id}`}>Mark attendance</Link>
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
