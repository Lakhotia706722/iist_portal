"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { GraduationCap, Search } from "lucide-react";

interface AssignedStudent {
  id: string;
  name: string;
  enrollmentNumber: string;
  branch: { name: string; code: string };
  batch: { name: string };
  latestSkillUp: { percentage: number; isPassed: boolean } | null;
  mockInterviewCount: number;
}

export function FacultyStudentsClient() {
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["faculty-students", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/faculty/students?${params}`);
      if (!res.ok) throw new Error("Failed to load students");
      return res.json() as Promise<{ students: AssignedStudent[]; pagination: { total: number } }>;
    },
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or enrollment number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {isLoading ? (
        <LoadingState text="Loading students…" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : data!.students.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No students found" description="Read-only view — SkillUp and mock interview performance for students in your scope." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Latest SkillUp</TableHead>
                  <TableHead>Mock Interviews</TableHead>
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
                    <TableCell>
                      {s.latestSkillUp ? `${s.latestSkillUp.percentage.toFixed(1)}%` : <span className="text-muted-foreground">No result</span>}
                    </TableCell>
                    <TableCell>{s.mockInterviewCount}</TableCell>
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
