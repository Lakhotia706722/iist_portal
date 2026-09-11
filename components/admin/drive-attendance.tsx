/**
 * Drive Attendance — Phase 4
 *
 * Per-round attendance marking. Pick a round, then mark participants
 * Present / Absent / Late / Excused individually or in bulk.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Search, Download, RefreshCw, Users } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { formatDateTime, cn } from "@/lib/utils";

interface DriveAttendanceProps {
  driveId: string;
}

const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

type Round = {
  id: string;
  roundNumber: number;
  title: string;
  scheduledAt: string | null;
  venue: string | null;
};

type Participant = {
  id: string;
  student: {
    enrollmentNumber: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    batch: { academicYear: string; branch: { code: string; name: string } | null } | null;
  };
  jobRole: { title: string };
  attendance: {
    id: string;
    status: string;
    note: string | null;
    markedAt: string;
  } | null;
};

type AttendanceResponse = {
  round: { id: string; title: string; scheduledAt: string | null; venue: string | null };
  participants: Participant[];
  summary: Record<string, number> & { total?: number };
};

function studentName(s: Participant["student"]) {
  return [s.firstName, s.lastName].filter(Boolean).join(" ") || s.enrollmentNumber;
}

export function DriveAttendance({ driveId }: DriveAttendanceProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [roundId, setRoundId] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>("PRESENT");

  const roundsQuery = useQuery({
    queryKey: ["drive-rounds", driveId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/drives/${driveId}/rounds`);
      if (!res.ok) throw new Error("Failed to load rounds");
      const body = await res.json();
      return (body.rounds ?? body ?? []) as Round[];
    },
  });

  const rounds = useMemo(() => roundsQuery.data ?? [], [roundsQuery.data]);

  // Default to the first round once they load.
  useEffect(() => {
    if (!roundId && rounds.length > 0) setRoundId(rounds[0].id);
  }, [rounds, roundId]);

  // Live — Phase 15: another admin/HOD marking attendance on this same
  // round concurrently should show up here.
  const attendanceQuery = useQuery({
    queryKey: ["round-attendance", roundId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/rounds/${roundId}/attendance`);
      if (!res.ok) throw new Error("Failed to load attendance");
      return res.json() as Promise<AttendanceResponse>;
    },
    enabled: !!roundId,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  const markOne = useMutation({
    mutationFn: async (vars: { roundParticipantId: string; status: AttendanceStatus }) => {
      const res = await fetch(`/api/admin/rounds/${roundId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to mark attendance");
      return body;
    },
    onSuccess: (_d, vars) => {
      toast({
        title: "Attendance marked",
        description: `Marked ${formatStatusLabel(vars.status)}.`,
        variant: "success",
      });
      qc.invalidateQueries({ queryKey: ["round-attendance", roundId] });
    },
    onError: (e: Error) =>
      toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const markBulk = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/rounds/${roundId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: [...selected].map((id) => ({
            roundParticipantId: id,
            status: bulkStatus,
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Bulk marking failed");
      return body as { updated: number; failed: unknown[] };
    },
    onSuccess: (body) => {
      toast({
        title: "Attendance updated",
        description: `${body.updated} participant(s) marked ${formatStatusLabel(bulkStatus)}.`,
        variant: "success",
      });
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["round-attendance", roundId] });
    },
    onError: (e: Error) =>
      toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const participants = useMemo(() => {
    const list = attendanceQuery.data?.participants ?? [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      (p) =>
        studentName(p.student).toLowerCase().includes(q) ||
        p.student.enrollmentNumber.toLowerCase().includes(q)
    );
  }, [attendanceQuery.data, search]);

  const allSelected =
    participants.length > 0 && participants.every((p) => selected.has(p.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportCsv = () => {
    const rows = participants.map((p) => [
      p.student.enrollmentNumber,
      studentName(p.student),
      p.student.batch?.branch?.code ?? "",
      p.jobRole.title,
      p.attendance?.status ?? "NOT_MARKED",
      p.attendance?.note ?? "",
    ]);
    const csv = [
      ["Enrollment", "Name", "Branch", "Role", "Attendance", "Note"],
      ...rows,
    ]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `round-${roundId}-attendance.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (roundsQuery.isLoading) return <LoadingState text="Loading rounds…" />;
  if (roundsQuery.isError) return <ErrorState onRetry={() => roundsQuery.refetch()} />;

  if (rounds.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No rounds scheduled"
        description="Create a round for this drive before marking attendance."
      />
    );
  }

  const summary = attendanceQuery.data?.summary;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Attendance</h2>
          <p className="text-sm text-muted-foreground">
            Mark attendance for each round of this drive.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => attendanceQuery.refetch()}
            disabled={attendanceQuery.isFetching}
          >
            <RefreshCw
              className={cn("mr-1.5 h-4 w-4", attendanceQuery.isFetching && "animate-spin")}
            />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={participants.length === 0}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Round picker */}
      <div className="flex flex-wrap gap-3">
        <Select
          aria-label="Select round"
          value={roundId}
          onChange={(e) => {
            setRoundId(e.target.value);
            setSelected(new Set());
          }}
          className="w-72"
        >
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>
              Round {r.roundNumber}: {r.title}
            </option>
          ))}
        </Select>
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search participants"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search participants"
          />
        </div>
      </div>

      {attendanceQuery.data?.round && (
        <p className="text-sm text-muted-foreground">
          {attendanceQuery.data.round.scheduledAt
            ? formatDateTime(attendanceQuery.data.round.scheduledAt)
            : "Not scheduled"}
          {attendanceQuery.data.round.venue ? ` · ${attendanceQuery.data.round.venue}` : ""}
        </p>
      )}

      {summary && (
        <div className="flex flex-wrap gap-2">
          {ATTENDANCE_STATUSES.map((s) => (
            <span
              key={s}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground"
            >
              {formatStatusLabel(s)} · {summary[s.toLowerCase()] ?? summary[s] ?? 0}
            </span>
          ))}
        </div>
      )}

      {/* Bulk bar */}
      {selected.size > 0 && (
        <Card className="flex flex-wrap items-center gap-3 p-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Select
            aria-label="Bulk attendance status"
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as AttendanceStatus)}
            className="w-40"
          >
            {ATTENDANCE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {formatStatusLabel(s)}
              </option>
            ))}
          </Select>
          <Button size="sm" onClick={() => markBulk.mutate()} disabled={markBulk.isPending}>
            {markBulk.isPending ? "Applying…" : "Apply to selected"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </Card>
      )}

      {attendanceQuery.isLoading ? (
        <LoadingState text="Loading participants…" />
      ) : attendanceQuery.isError ? (
        <ErrorState onRetry={() => attendanceQuery.refetch()} />
      ) : participants.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No participants in this round"
          description="Add participants to the round before marking attendance."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all participants"
                      className="h-4 w-4 rounded border-input"
                      checked={allSelected}
                      onChange={() =>
                        setSelected(
                          allSelected ? new Set() : new Set(participants.map((p) => p.id))
                        )
                      }
                    />
                  </TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead className="text-right">Mark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={`Select ${studentName(p.student)}`}
                        className="h-4 w-4 rounded border-input"
                        checked={selected.has(p.id)}
                        onChange={() => toggle(p.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{studentName(p.student)}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.student.enrollmentNumber}
                      </div>
                    </TableCell>
                    <TableCell>{p.student.batch?.branch?.code ?? "—"}</TableCell>
                    <TableCell>{p.jobRole.title}</TableCell>
                    <TableCell>
                      {p.attendance ? (
                        <StatusBadge status={p.attendance.status} />
                      ) : (
                        <span className="text-xs text-muted-foreground">Not marked</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        {ATTENDANCE_STATUSES.map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={p.attendance?.status === s ? "default" : "outline"}
                            disabled={markOne.isPending}
                            onClick={() =>
                              markOne.mutate({ roundParticipantId: p.id, status: s })
                            }
                          >
                            {s.charAt(0) + s.slice(1, 3).toLowerCase()}
                          </Button>
                        ))}
                      </div>
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
