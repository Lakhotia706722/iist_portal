"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Search, FileText, Users } from "lucide-react";

interface DriveDetail {
  id: string;
  title: string;
  status: string;
  academicYear: string;
  description: string | null;
  workMode: string;
  locations: string[];
  jobRoles: Array<{ id: string; title: string; ctcMin: number | null; ctcMax: number | null; openings: number | null }>;
  rounds: Array<{ id: string; title: string; roundNumber: number; scheduledAt: string | null }>;
}

interface Applicant {
  applicationId: string;
  status: string;
  appliedAt: string;
  student: { id: string; name: string; enrollmentNumber: string; branch: { name: string; code: string }; batch: { name: string } };
  resumeUrl: string | null;
  rounds: Array<{ roundId: string; title: string; roundNumber: number; result: string | null; attendance: string | null }>;
}

export function CompanyDriveDetailClient({ driveId }: { driveId: string }) {
  const [search, setSearch] = useState("");

  const driveQuery = useQuery({
    queryKey: ["company-drive", driveId],
    queryFn: async () => {
      const res = await fetch(`/api/company/drives/${driveId}`);
      if (!res.ok) throw new Error("Failed to load drive");
      return (await res.json()).drive as DriveDetail;
    },
  });

  const applicantsQuery = useQuery({
    queryKey: ["company-drive-applicants", driveId, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/company/drives/${driveId}/applicants?${params}`);
      if (!res.ok) throw new Error("Failed to load applicants");
      return res.json() as Promise<{ applicants: Applicant[]; pagination: { total: number } }>;
    },
  });

  if (driveQuery.isLoading) return <LoadingState text="Loading drive…" />;
  if (driveQuery.isError) return <ErrorState onRetry={() => driveQuery.refetch()} />;
  const drive = driveQuery.data!;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{drive.title}</CardTitle>
          <StatusBadge status={drive.status} />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Academic year</p>
            <p>{drive.academicYear}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Job roles</p>
            <p>{drive.jobRoles.map((r) => r.title).join(", ") || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Rounds</p>
            <p>{drive.rounds.length}</p>
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4" /> Applicants</h3>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search applicants…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
        </div>

        {applicantsQuery.isLoading ? (
          <LoadingState text="Loading applicants…" />
        ) : applicantsQuery.isError ? (
          <ErrorState onRetry={() => applicantsQuery.refetch()} />
        ) : applicantsQuery.data!.applicants.length === 0 ? (
          <EmptyState icon={Users} title="No applicants yet" />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Branch / Batch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Latest round</TableHead>
                    <TableHead>Resume</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applicantsQuery.data!.applicants.map((a) => {
                    const latestRound = a.rounds[a.rounds.length - 1];
                    return (
                      <TableRow key={a.applicationId}>
                        <TableCell>
                          <div className="font-medium">{a.student.name}</div>
                          <div className="text-xs text-muted-foreground">{a.student.enrollmentNumber}</div>
                        </TableCell>
                        <TableCell>
                          {a.student.branch.code} · {a.student.batch.name}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={a.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {latestRound ? `${latestRound.title}${latestRound.result ? ` — ${latestRound.result}` : ""}` : "—"}
                        </TableCell>
                        <TableCell>
                          {a.resumeUrl ? (
                            <a href={a.resumeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                              <FileText className="h-3.5 w-3.5" /> View
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not submitted</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
