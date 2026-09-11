"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect as Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { fetchJson } from "@/lib/api-client";
import { hodApplicationsResponseSchema } from "@/lib/validations/responses";
import { Search, ClipboardList } from "lucide-react";

const STATUS_OPTIONS = [
  "APPLIED", "UNDER_REVIEW", "SHORTLISTED", "WRITTEN_TEST", "TECHNICAL_ROUND",
  "HR_ROUND", "SELECTED", "REJECTED", "OFFER_MADE", "ACCEPTED", "WITHDRAWN",
];

/** Phase 12 — department-scoped applications for the HOD portal. */
export function HodApplicationsClient() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Live — Phase 15: an admin acting on a department student's application.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["hod-applications", search, statusFilter],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "100" });
      if (search) p.set("search", search);
      if (statusFilter) p.set("status", statusFilter);
      return fetchJson(`/api/hod/applications?${p}`, hodApplicationsResponseSchema);
    },
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
  const applicants = data?.applications ?? [];

  if (isLoading) return <LoadingState text="Loading applications…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search student or role" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search applications" />
        </div>
        <Select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-48">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      {applicants.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No applications found" description="Your department's students' applications will appear here." />
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
