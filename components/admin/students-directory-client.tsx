"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect as Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { GraduationCap, Search } from "lucide-react";

interface AdminStudent {
  id: string;
  name: string;
  enrollmentNumber: string;
  branch: { name: string; code: string };
  batch: { name: string };
  latestSkillUpPercent: number | null;
  applicationCount: number;
  shortlistedCount: number;
  isPlaced: boolean;
}

const PAGE_SIZE = 50;

/**
 * Phase 12 — Admin's "Students" nav item previously had no real screen
 * (only a lightweight picker endpoint used by other pages). Mirrors
 * hod-students-client.tsx's table exactly, unscoped, with a branch filter
 * and pagination since this spans every department.
 */
export function StudentsDirectoryClient() {
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [page, setPage] = useState(0);

  const { data: branches } = useQuery<{ items: { id: string; name: string; code: string }[] }>({
    queryKey: ["branches-list"],
    queryFn: async () => {
      const res = await fetch("/api/admin/branches?pageSize=200&includeInactive=false");
      return res.json();
    },
  });

  // Live — Phase 15: this is the closest real surface to an "admin
  // student-detail view" in the current app (no dedicated per-student
  // detail page exists yet — see the phase report) — a student completing
  // onboarding or their application/placement counts changing should
  // still show up here without a reload.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-students-directory", search, branchId, page],
    queryFn: async () => {
      const params = new URLSearchParams({ detailed: "true", limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
      if (search) params.set("search", search);
      if (branchId) params.set("branchId", branchId);
      const res = await fetch(`/api/admin/students?${params}`);
      if (!res.ok) throw new Error("Failed to load students");
      return res.json() as Promise<{ students: AdminStudent[]; pagination: { total: number; hasMore: boolean } }>;
    },
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or enrollment number…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-8" />
        </div>
        <Select value={branchId} onChange={(e) => { setBranchId(e.target.value); setPage(0); }} className="w-56" aria-label="Filter by branch">
          <option value="">All branches</option>
          {branches?.items.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      </div>

      {isLoading ? (
        <LoadingState text="Loading students…" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data?.students.length ? (
        <EmptyState icon={GraduationCap} title="No students found" />
      ) : (
        <>
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>SkillUp</TableHead>
                    <TableHead>Applications</TableHead>
                    <TableHead>Shortlisted</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.students.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.enrollmentNumber}</div>
                      </TableCell>
                      <TableCell>{s.branch.code}</TableCell>
                      <TableCell>{s.batch.name}</TableCell>
                      <TableCell>{s.latestSkillUpPercent != null ? `${s.latestSkillUpPercent.toFixed(1)}%` : "—"}</TableCell>
                      <TableCell>{s.applicationCount}</TableCell>
                      <TableCell>{s.shortlistedCount}</TableCell>
                      <TableCell>
                        {s.isPlaced ? <Badge variant="success">Placed</Badge> : <Badge variant="secondary">Not placed</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{data.pagination.total} student(s) total</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={!data.pagination.hasMore} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
