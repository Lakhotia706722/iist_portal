"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect as Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { fetchJson } from "@/lib/api-client";
import { allApplicationsResponseSchema } from "@/lib/validations/responses";
import { Search, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";

const STATUS_OPTIONS = [
  "APPLIED", "UNDER_REVIEW", "SHORTLISTED", "WRITTEN_TEST", "TECHNICAL_ROUND",
  "HR_ROUND", "SELECTED", "REJECTED", "OFFER_MADE", "ACCEPTED", "WITHDRAWN",
];

/**
 * Phase 12 — cross-drive applications browser. Shared by /admin/applications
 * and /faculty/applications (same permission, `application:read:all`, held
 * by both roles) — deliberately read-only here; taking action on an
 * application (shortlist/reject/advance a round) already has a real,
 * tested UI scoped to its drive (the Shortlisting/Rounds tabs on
 * /admin/drives/[id]) — this page's job is finding one, not re-implementing
 * those actions a second time.
 */
export function AllApplicationsClient({ driveLinkBase }: { driveLinkBase?: string } = {}) {
  const [applicants, setApplicants] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const p = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
      if (search) p.set("search", search);
      if (statusFilter) p.set("status", statusFilter);
      const data = await fetchJson(`/api/admin/applications?${p}`, allApplicationsResponseSchema);
      setApplicants(data.applications);
      setTotal(data.pagination.total);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);
  useEffect(() => { setPage(0); }, [search, statusFilter]);

  if (loading) return <LoadingState text="Loading applications…" />;
  if (error) return <ErrorState onRetry={fetchApplications} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search student, enrollment, or role"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search applications"
          />
        </div>
        <Select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-48">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      {applicants.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No applications found" description="Try adjusting your filters." />
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
                  {driveLinkBase && <th className="p-3 text-left font-medium">Drive</th>}
                </tr>
              </thead>
              <tbody>
                {applicants.map((a) => (
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
                    {driveLinkBase && (
                      <td className="p-3">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`${driveLinkBase}/${a.jobRole.drive.id}`}>View drive</Link>
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

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
