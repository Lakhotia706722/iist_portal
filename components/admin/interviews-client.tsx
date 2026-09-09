"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect as Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { StatusBadge, formatStatusLabel } from "@/components/shared/status-badge";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/utils";
import { Mic2, Plus, ClipboardCheck, Search } from "lucide-react";
import {
  INTERVIEW_TYPES,
  INTERVIEW_MODES,
  INTERVIEW_STATUSES,
} from "@/lib/validations/interview";

type Interview = {
  id: string;
  interviewerName: string;
  scheduledAt: string;
  targetRole: string | null;
  type: string;
  mode: string;
  venue: string | null;
  status: string;
  student: {
    id: string;
    enrollmentNumber: string;
    firstName: string | null;
    lastName: string | null;
    branch: { code: string } | null;
  };
  result: { overallScore: number } | null;
};

const EMPTY_FORM = {
  studentId: "",
  interviewerName: "",
  scheduledAt: "",
  durationMins: "45",
  targetRole: "",
  type: "MIXED",
  mode: "OFFLINE",
  venue: "",
  status: "SCHEDULED",
};

const EMPTY_RESULT = {
  technicalScore: "",
  communicationScore: "",
  confidenceScore: "",
  problemSolvingScore: "",
  hrScore: "",
  feedback: "",
  strengths: "",
  weaknesses: "",
  improvementSuggestions: "",
};

function studentName(s: Interview["student"]) {
  return [s.firstName, s.lastName].filter(Boolean).join(" ") || s.enrollmentNumber;
}

export function AdminInterviewsClient() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [scoreTarget, setScoreTarget] = useState<Interview | null>(null);
  const [result, setResult] = useState(EMPTY_RESULT);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-interviews", search],
    queryFn: async () => {
      const qs = new URLSearchParams({ limit: "100" });
      if (search) qs.set("search", search);
      const res = await fetch(`/api/admin/interviews?${qs}`);
      if (!res.ok) throw new Error("Failed to load interviews");
      return res.json() as Promise<{ interviews: Interview[]; total: number }>;
    },
  });

  const students = useQuery({
    queryKey: ["students-for-interview"],
    queryFn: async () => {
      const res = await fetch("/api/admin/students?limit=500");
      if (!res.ok) return { students: [] };
      const body = await res.json();
      return { students: body.students ?? body.items ?? [] };
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: form.studentId,
          interviewerName: form.interviewerName,
          scheduledAt: form.scheduledAt,
          durationMins: form.durationMins ? Number(form.durationMins) : null,
          targetRole: form.targetRole || null,
          type: form.type,
          mode: form.mode,
          venue: form.venue || null,
          status: form.status,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(
          body.error ?? Object.values(body.fieldErrors ?? {})[0] ?? "Could not schedule"
        );
      }
      return body;
    },
    onSuccess: () => {
      toast({
        title: "Interview scheduled",
        description: "The student has been notified.",
        variant: "success",
      });
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      setFormError(null);
      qc.invalidateQueries({ queryKey: ["admin-interviews"] });
    },
    onError: (e: Error) => {
      setFormError(e.message);
      toast({ title: "Could not schedule", description: e.message, variant: "destructive" });
    },
  });

  const saveResult = useMutation({
    mutationFn: async () => {
      const num = (v: string) => (v === "" ? null : Number(v));
      const list = (v: string) =>
        v
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);

      const res = await fetch(`/api/admin/interviews/${scoreTarget!.id}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technicalScore: num(result.technicalScore),
          communicationScore: num(result.communicationScore),
          confidenceScore: num(result.confidenceScore),
          problemSolvingScore: num(result.problemSolvingScore),
          hrScore: num(result.hrScore),
          feedback: result.feedback || null,
          strengths: list(result.strengths),
          weaknesses: list(result.weaknesses),
          improvementSuggestions: list(result.improvementSuggestions),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save feedback");
      return body;
    },
    onSuccess: () => {
      toast({
        title: "Feedback recorded",
        description: "The student can now see their scorecard.",
        variant: "success",
      });
      setScoreTarget(null);
      setResult(EMPTY_RESULT);
      qc.invalidateQueries({ queryKey: ["admin-interviews"] });
    },
    onError: (e: Error) =>
      toast({ title: "Could not save", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <LoadingState text="Loading interviews…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const interviews = data?.interviews ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => {
            setForm(EMPTY_FORM);
            setFormError(null);
            setCreateOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Schedule interview
        </Button>
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search student or interviewer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search interviews"
          />
        </div>
      </div>

      {interviews.length === 0 ? (
        <EmptyState
          icon={Mic2}
          title="No mock interviews"
          description="Schedule a mock interview for a student, then record the scorecard afterwards."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Interviewer</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Target role</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {interviews.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      <div className="font-medium">{studentName(i.student)}</div>
                      <div className="text-xs text-muted-foreground">
                        {i.student.enrollmentNumber}
                        {i.student.branch ? ` · ${i.student.branch.code}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>{i.interviewerName}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(i.scheduledAt)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={i.type} />
                    </TableCell>
                    <TableCell>{i.targetRole ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">
                      {i.result ? `${i.result.overallScore}/10` : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={i.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setScoreTarget(i);
                          setResult(EMPTY_RESULT);
                        }}
                      >
                        <ClipboardCheck className="mr-1.5 h-4 w-4" />
                        {i.result ? "Edit feedback" : "Record feedback"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Schedule */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Schedule mock interview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="Student" htmlFor="mi-student" required>
              <Select
                id="mi-student"
                value={form.studentId}
                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
              >
                <option value="">Choose a student…</option>
                {(students.data?.students ?? []).map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.enrollmentNumber} — {[s.firstName, s.lastName].filter(Boolean).join(" ")}
                  </option>
                ))}
              </Select>
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Interviewer" htmlFor="mi-interviewer" required>
                <Input
                  id="mi-interviewer"
                  value={form.interviewerName}
                  onChange={(e) => setForm({ ...form, interviewerName: e.target.value })}
                />
              </FormField>
              <FormField label="Date &amp; time" htmlFor="mi-when" required>
                <Input
                  id="mi-when"
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                />
              </FormField>
              <FormField label="Type" htmlFor="mi-type">
                <Select
                  id="mi-type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {INTERVIEW_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {formatStatusLabel(t)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Mode" htmlFor="mi-mode">
                <Select
                  id="mi-mode"
                  value={form.mode}
                  onChange={(e) => setForm({ ...form, mode: e.target.value })}
                >
                  {INTERVIEW_MODES.map((m) => (
                    <option key={m} value={m}>
                      {formatStatusLabel(m)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Target role" htmlFor="mi-role">
                <Input
                  id="mi-role"
                  value={form.targetRole}
                  onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
                  placeholder="SDE-1"
                />
              </FormField>
              <FormField label="Duration (minutes)" htmlFor="mi-dur">
                <Input
                  id="mi-dur"
                  type="number"
                  min="5"
                  value={form.durationMins}
                  onChange={(e) => setForm({ ...form, durationMins: e.target.value })}
                />
              </FormField>
              <FormField label="Venue" htmlFor="mi-venue">
                <Input
                  id="mi-venue"
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                />
              </FormField>
              <FormField label="Status" htmlFor="mi-status">
                <Select
                  id="mi-status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {INTERVIEW_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {formatStatusLabel(s)}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !form.studentId || !form.interviewerName || !form.scheduledAt || create.isPending
              }
              onClick={() => {
                setFormError(null);
                create.mutate();
              }}
            >
              {create.isPending ? "Saving…" : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scorecard */}
      <Dialog open={!!scoreTarget} onOpenChange={(o) => !o && setScoreTarget(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Feedback — {scoreTarget ? studentName(scoreTarget.student) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scores are out of 10. The overall score is averaged from whatever you fill in.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["technicalScore", "Technical"],
                  ["communicationScore", "Communication"],
                  ["confidenceScore", "Confidence"],
                  ["problemSolvingScore", "Problem solving"],
                  ["hrScore", "HR"],
                ] as const
              ).map(([key, label]) => (
                <FormField key={key} label={label} htmlFor={`score-${key}`}>
                  <Input
                    id={`score-${key}`}
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={result[key]}
                    onChange={(e) => setResult({ ...result, [key]: e.target.value })}
                  />
                </FormField>
              ))}
            </div>

            <FormField label="Overall feedback" htmlFor="score-feedback">
              <Textarea
                id="score-feedback"
                rows={4}
                value={result.feedback}
                onChange={(e) => setResult({ ...result, feedback: e.target.value })}
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Strengths" htmlFor="score-strengths" hint="One per line">
                <Textarea
                  id="score-strengths"
                  rows={4}
                  value={result.strengths}
                  onChange={(e) => setResult({ ...result, strengths: e.target.value })}
                />
              </FormField>
              <FormField label="Weaknesses" htmlFor="score-weaknesses" hint="One per line">
                <Textarea
                  id="score-weaknesses"
                  rows={4}
                  value={result.weaknesses}
                  onChange={(e) => setResult({ ...result, weaknesses: e.target.value })}
                />
              </FormField>
              <FormField label="Suggestions" htmlFor="score-suggestions" hint="One per line">
                <Textarea
                  id="score-suggestions"
                  rows={4}
                  value={result.improvementSuggestions}
                  onChange={(e) =>
                    setResult({ ...result, improvementSuggestions: e.target.value })
                  }
                />
              </FormField>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScoreTarget(null)}>
              Cancel
            </Button>
            <Button disabled={saveResult.isPending} onClick={() => saveResult.mutate()}>
              {saveResult.isPending ? "Saving…" : "Save feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
