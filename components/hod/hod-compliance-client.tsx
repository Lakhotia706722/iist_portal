"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { ComplianceBadge } from "@/components/shared/compliance-badge";
import { ShieldCheck } from "lucide-react";

interface DepartmentComplianceRow {
  studentId: string;
  name: string;
  enrollmentNumber: string;
  compliance: {
    status: string;
    reasons: string[];
    isOverridden: boolean;
  } | null;
}

export function HodComplianceClient() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["hod-compliance"],
    queryFn: async () => {
      const res = await fetch("/api/hod/compliance");
      if (!res.ok) throw new Error("Failed to load compliance data");
      return res.json() as Promise<{ students: DepartmentComplianceRow[] }>;
    },
  });

  if (isLoading) return <LoadingState text="Loading compliance report…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (data!.students.length === 0) return <EmptyState icon={ShieldCheck} title="No students found" />;

  return (
    <Card>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reasons</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data!.students.map((s) => (
              <TableRow key={s.studentId}>
                <TableCell>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.enrollmentNumber}</div>
                </TableCell>
                <TableCell>
                  {s.compliance ? (
                    <ComplianceBadge status={s.compliance.status} isOverridden={s.compliance.isOverridden} />
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="max-w-md text-sm text-muted-foreground">
                  {s.compliance?.reasons.join("; ") || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
