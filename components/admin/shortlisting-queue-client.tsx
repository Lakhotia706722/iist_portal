"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { fetchJson } from "@/lib/api-client";
import { allApplicationsResponseSchema } from "@/lib/validations/responses";
import { Search, ListChecks } from "lucide-react";

/**
 * Phase 12 — Admin's "Shortlisting" nav item. Cross-drive queue of
 * applications still awaiting a decision (APPLIED / UNDER_REVIEW) — the
 * actual shortlist/reject action stays on each drive's own Shortlisting
 * tab (already built + tested), reached here via "Review".
 */
export function ShortlistingQueueClient() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const p = new URLSearchParams({ limit: "100" });
      if (search) p.set("search", search);
      const data = await fetchJson(`/api/admin/shortlisting?${p}`, allApplicationsResponseSchema);
      setApplications(data.applications);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  if (loading) return <LoadingState text="Loading queue…" />;
  if (error) return <ErrorState onRetry={fetchQueue} />;

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search student or role" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search shortlisting queue" />
      </div>

      {applications.length === 0 ? (
        <EmptyState icon={ListChecks} title="Nothing awaiting a decision" description="Applications that need shortlisting will appear here." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="p-3 text-left font-medium">Student</th>
                  <th className="p-3 text-left font-medium">Role / Drive</th>
                  <th className="p-3 text-left font-medium">CGPA</th>
                  <th className="p-3 text-left font-medium">Applied</th>
                  <th className="p-3 text-left font-medium">Status</th>
                  <th className="p-3 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((a) => (
                  <tr key={a.id} className="border-b hover:bg-muted/20">
                    <td className="p-3">
                      <p className="font-medium">{[a.student.firstName, a.student.lastName].filter(Boolean).join(" ") || a.student.enrollmentNumber}</p>
                      <p className="text-xs text-muted-foreground">{a.student.enrollmentNumber} · {a.student.batch.branch.code}</p>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {a.jobRole.title}
                      <div className="text-xs">{a.jobRole.drive.company.name}</div>
                    </td>
                    <td className="p-3 font-mono">{a.student.academicRecord?.currentCgpa?.toFixed(2) ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{new Date(a.appliedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                    <td className="p-3"><StatusBadge status={a.status} className="text-xs" /></td>
                    <td className="p-3">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/drives/${a.jobRole.drive.id}`}>Review</Link>
                      </Button>
                    </td>
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
