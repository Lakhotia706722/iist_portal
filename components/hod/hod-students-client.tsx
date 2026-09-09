"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { GraduationCap, Search } from "lucide-react";

interface DepartmentStudent {
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

export function HodStudentsClient() {
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["hod-students", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/hod/students?${params}`);
      if (!res.ok) throw new Error("Failed to load students");
      return res.json() as Promise<{ students: DepartmentStudent[] }>;
    },
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or enrollment number…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
      </div>

      {isLoading ? (
        <LoadingState text="Loading students…" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : data!.students.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No students found" />
      ) : (
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
                {data!.students.map((s) => (
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
      )}
    </div>
  );
}
