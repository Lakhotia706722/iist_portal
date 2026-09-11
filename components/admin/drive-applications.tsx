/**
 * Drive Applications — Phase 4
 *
 * Real applicant table for a drive: search, filter by role/status, sort by
 * name / CGPA / applied date, and drill into per-application status history.
 */

"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Search,
  ArrowUpDown,
  Download,
  FileText,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect as Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { StatusBadge, formatStatusLabel } from "@/components/shared/status-badge";
import { formatDate, cn } from "@/lib/utils";

interface DriveApplicationsProps {
  driveId: string;
}

type Application = {
  id: string;
  status: string;
  appliedAt: string;
  student: {
    id: string;
    enrollmentNumber: string;
    firstName: string | null;
    lastName: string | null;
    batch: {
      academicYear: string;
      branch: { code: string; name: string } | null;
    } | null;
    academicRecord: { currentCgpa: number | null; currentSemester: number | null } | null;
  };
  jobRole: { id: string; title: string };
  skillUpAverage: number | null;
  resumeVersion: { id: string; fileKey: string | null } | null;
};

type Response = {
  applications: Application[];
  stats: { byStatus: Record<string, number>; byJobRole: Record<string, number> };
  pagination: { total: number };
};

const APPLICATION_STATUSES = [
  "APPLIED",
  "UNDER_REVIEW",
  "SHORTLISTED",
  "WRITTEN_TEST",
  "TECHNICAL_ROUND",
  "HR_ROUND",
  "FINAL_ROUND",
  "SELECTED",
  "REJECTED",
  "WITHDRAWN",
  "ON_HOLD",
];

type SortField = "name" | "cgpa" | "appliedAt" | "branch" | "skillup";

function studentName(s: Application["student"]) {
  return [s.firstName, s.lastName].filter(Boolean).join(" ") || s.enrollmentNumber;
}

async function fetchApplications(driveId: string, status: string, search: string) {
  const qs = new URLSearchParams({ limit: "200" });
  if (status) qs.set("status", status);
  if (search) qs.set("search", search);
  const res = await fetch(`/api/admin/drives/${driveId}/applications?${qs}`);
  if (!res.ok) throw new Error("Failed to load applications");
  return res.json() as Promise<Response>;
}

export function DriveApplications({ driveId }: DriveApplicationsProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [minCgpa, setMinCgpa] = useState("");
  const [sortField, setSortField] = useState<SortField>("appliedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["drive-applications", driveId, status, search],
    queryFn: () => fetchApplications(driveId, status, search),
  });

  const applications = useMemo(() => data?.applications ?? [], [data]);

  const roles = useMemo(() => {
    const m = new Map<string, string>();
    applications.forEach((a) => m.set(a.jobRole.id, a.jobRole.title));
    return [...m.entries()];
  }, [applications]);

  const branches = useMemo(() => {
    const s = new Set<string>();
    applications.forEach((a) => {
      const code = a.student.batch?.branch?.code;
      if (code) s.add(code);
    });
    return [...s].sort();
  }, [applications]);

  const displayed = useMemo(() => {
    const min = minCgpa ? parseFloat(minCgpa) : null;
    return applications
      .filter((a) => {
        if (roleFilter && a.jobRole.id !== roleFilter) return false;
        if (branchFilter && a.student.batch?.branch?.code !== branchFilter) return false;
        if (min != null) {
          const cgpa = a.student.academicRecord?.currentCgpa;
          if (cgpa == null || cgpa < min) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case "name":
            cmp = studentName(a.student).localeCompare(studentName(b.student));
            break;
          case "cgpa":
            cmp =
              (a.student.academicRecord?.currentCgpa ?? -1) -
              (b.student.academicRecord?.currentCgpa ?? -1);
            break;
          case "branch":
            cmp = (a.student.batch?.branch?.code ?? "").localeCompare(
              b.student.batch?.branch?.code ?? ""
            );
            break;
          case "skillup":
            cmp = (a.skillUpAverage ?? -1) - (b.skillUpAverage ?? -1);
            break;
          default:
            cmp = new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime();
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [applications, roleFilter, branchFilter, minCgpa, sortField, sortDir]);

  const sortBy = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir(field === "name" || field === "branch" ? "asc" : "desc");
    }
  };

  const exportCsv = () => {
    const header = [
      "Enrollment",
      "Name",
      "Branch",
      "Batch",
      "CGPA",
      "SkillUp Avg",
      "Role",
      "Status",
      "Applied",
    ];
    const rows = displayed.map((a) => [
      a.student.enrollmentNumber,
      studentName(a.student),
      a.student.batch?.branch?.code ?? "",
      a.student.batch?.academicYear ?? "",
      a.student.academicRecord?.currentCgpa ?? "",
      a.skillUpAverage != null ? `${a.skillUpAverage.toFixed(1)}%` : "",
      a.jobRole.title,
      a.status,
      new Date(a.appliedAt).toISOString().slice(0, 10),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `drive-${driveId}-applications.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <LoadingState text="Loading applications…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const stats = data?.stats.byStatus ?? {};

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Applications</h2>
          <p className="text-sm text-muted-foreground">
            {data?.pagination.total ?? 0} total · {displayed.length} shown
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("mr-1.5 h-4 w-4", isFetching && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={displayed.length === 0}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Status summary */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(stats)
          .sort((a, b) => b[1] - a[1])
          .map(([s, count]) => (
            <button
              key={s}
              onClick={() => setStatus(status === s ? "" : s)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                status === s ? "border-primary bg-primary/10" : "hover:bg-muted"
              )}
            >
              {formatStatusLabel(s)} · {count}
            </button>
          ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name or enrollment number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search applicants"
          />
        </div>
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-44"
        >
          <option value="">All statuses</option>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatStatusLabel(s)}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by job role"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="w-48"
        >
          <option value="">All roles</option>
          {roles.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by branch"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="w-36"
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </Select>
        <Input
          type="number"
          step="0.1"
          min="0"
          max="10"
          className="w-32"
          placeholder="Min CGPA"
          value={minCgpa}
          onChange={(e) => setMinCgpa(e.target.value)}
          aria-label="Minimum CGPA"
        />
      </div>

      {displayed.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No applications match"
          description={
            applications.length === 0
              ? "No students have applied to this drive yet."
              : "Try relaxing the filters above."
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortHeader label="Student" field="name" active={sortField} dir={sortDir} onClick={sortBy} />
                  </TableHead>
                  <TableHead>
                    <SortHeader label="Branch" field="branch" active={sortField} dir={sortDir} onClick={sortBy} />
                  </TableHead>
                  <TableHead>
                    <SortHeader label="CGPA" field="cgpa" active={sortField} dir={sortDir} onClick={sortBy} />
                  </TableHead>
                  <TableHead>
                    <SortHeader label="SkillUp" field="skillup" active={sortField} dir={sortDir} onClick={sortBy} />
                  </TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>
                    <SortHeader label="Applied" field="appliedAt" active={sortField} dir={sortDir} onClick={sortBy} />
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resume</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">{studentName(a.student)}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.student.enrollmentNumber}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {a.student.batch?.branch?.code ?? "—"}
                      <div className="text-xs text-muted-foreground">
                        {a.student.batch?.academicYear ?? ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      {a.student.academicRecord?.currentCgpa?.toFixed(2) ?? "—"}
                    </TableCell>
                    <TableCell>
                      {a.skillUpAverage != null ? (
                        <span
                          className={cn(
                            "font-medium",
                            a.skillUpAverage >= 70
                              ? "text-emerald-600"
                              : a.skillUpAverage >= 40
                                ? "text-amber-600"
                                : "text-red-600"
                          )}
                        >
                          {a.skillUpAverage.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No results</span>
                      )}
                    </TableCell>
                    <TableCell>{a.jobRole.title}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(a.appliedAt)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                    <TableCell>
                      {a.resumeVersion?.fileKey ? (
                        <Button asChild variant="ghost" size="sm">
                          <a
                            href={`/api/files/${encodeURIComponent(a.resumeVersion.fileKey)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <FileText className="h-4 w-4" />
                            <span className="sr-only">View resume</span>
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}

function SortHeader({
  label,
  field,
  active,
  dir,
  onClick,
}: {
  label: string;
  field: SortField;
  active: SortField;
  dir: "asc" | "desc";
  onClick: (f: SortField) => void;
}) {
  return (
    <button
      onClick={() => onClick(field)}
      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
      aria-label={`Sort by ${label}`}
    >
      {label}
      <ArrowUpDown
        className={cn(
          "h-3 w-3",
          active === field ? "text-foreground" : "text-muted-foreground/40"
        )}
      />
      {active === field && <span className="sr-only">{dir === "asc" ? "ascending" : "descending"}</span>}
    </button>
  );
}
