"use client";

import Link from "next/link";
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
import { formatDate } from "@/lib/utils";
import { ShieldAlert, Plus, Search, FileText, Upload } from "lucide-react";
import {
  VIOLATION_TYPES,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
} from "@/lib/validations/compliance";

type Incident = {
  id: string;
  violationType: string;
  severity: string;
  description: string;
  incidentDate: string;
  actionTaken: string | null;
  adminRemarks: string | null;
  documentKey: string | null;
  status: string;
  student: {
    id: string;
    enrollmentNumber: string;
    firstName: string | null;
    lastName: string | null;
    branch: { code: string } | null;
  };
  company: { id: string; name: string } | null;
};

const EMPTY_FORM = {
  studentId: "",
  companyId: "",
  violationType: "OTHER",
  severity: "MEDIUM",
  description: "",
  incidentDate: new Date().toISOString().slice(0, 10),
  actionTaken: "",
  status: "OPEN",
};

function studentName(s: Incident["student"]) {
  return [s.firstName, s.lastName].filter(Boolean).join(" ") || s.enrollmentNumber;
}

export function IncidentsClient({ studentId }: { studentId?: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, studentId: studentId ?? "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Incident | null>(null);
  const [editRemarks, setEditRemarks] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [uploadTarget, setUploadTarget] = useState<Incident | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-incidents", studentId, search, severityFilter, statusFilter],
    queryFn: async () => {
      const qs = new URLSearchParams({ limit: "100" });
      if (studentId) qs.set("studentId", studentId);
      if (search) qs.set("search", search);
      if (severityFilter) qs.set("severity", severityFilter);
      if (statusFilter) qs.set("status", statusFilter);
      const res = await fetch(`/api/admin/incidents?${qs}`);
      if (!res.ok) throw new Error("Failed to load incidents");
      return res.json() as Promise<{ incidents: Incident[]; total: number }>;
    },
  });

  const students = useQuery({
    queryKey: ["students-for-incident"],
    queryFn: async () => {
      const res = await fetch("/api/admin/students?limit=500");
      if (!res.ok) return { students: [] };
      const body = await res.json();
      return { students: body.students ?? [] };
    },
    enabled: createOpen && !studentId,
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: form.studentId,
          companyId: form.companyId || null,
          violationType: form.violationType,
          severity: form.severity,
          description: form.description,
          incidentDate: form.incidentDate,
          actionTaken: form.actionTaken || null,
          status: form.status,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? Object.values(body.fieldErrors ?? {})[0] ?? "Could not record incident");
      }
      return body;
    },
    onSuccess: () => {
      toast({ title: "Incident recorded", variant: "success" });
      setCreateOpen(false);
      setForm({ ...EMPTY_FORM, studentId: studentId ?? "" });
      setFormError(null);
      qc.invalidateQueries({ queryKey: ["admin-incidents"] });
      // Phase 10: the compliance status card on this same page (see
      // AdminStudentCompliancePage) reads its own ["compliance", endpoint]
      // query — recording an incident here never told it to refetch, so
      // an admin recording a HIGH/CRITICAL incident saw the incident
      // appear in the list below while the status card above it kept
      // showing the stale pre-incident status until a manual reload.
      qc.invalidateQueries({ queryKey: ["compliance"] });
    },
    onError: (e: Error) => {
      setFormError(e.message);
      toast({ title: "Could not record incident", description: e.message, variant: "destructive" });
    },
  });

  const update = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/incidents/${editTarget!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: editStatus, adminRemarks: editRemarks || null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Update failed");
      return body;
    },
    onSuccess: () => {
      toast({ title: "Incident updated", variant: "success" });
      setEditTarget(null);
      qc.invalidateQueries({ queryKey: ["admin-incidents"] });
      // Same reasoning as the create mutation above — resolving/dismissing
      // an incident (or changing its severity) also changes the derived
      // compliance status.
      qc.invalidateQueries({ queryKey: ["compliance"] });
    },
    onError: (e: Error) =>
      toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const upload = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("file", file!);
      const res = await fetch(`/api/admin/incidents/${uploadTarget!.id}/document`, {
        method: "POST",
        body: fd,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Upload failed");
      return body;
    },
    onSuccess: () => {
      toast({ title: "Evidence uploaded", variant: "success" });
      setUploadTarget(null);
      setFile(null);
      qc.invalidateQueries({ queryKey: ["admin-incidents"] });
    },
    onError: (e: Error) =>
      toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <LoadingState text="Loading incidents…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const incidents = data?.incidents ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => {
            setForm({ ...EMPTY_FORM, studentId: studentId ?? "" });
            setFormError(null);
            setCreateOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Record incident
        </Button>
        {!studentId && (
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search student or description"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search incidents"
            />
          </div>
        )}
        <Select
          aria-label="Filter by severity"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="w-40"
        >
          <option value="">All severities</option>
          {INCIDENT_SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {formatStatusLabel(s)}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-40"
        >
          <option value="">All statuses</option>
          {INCIDENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatStatusLabel(s)}
            </option>
          ))}
        </Select>
      </div>

      {incidents.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No incidents recorded"
          description="Discipline and policy-violation records for students appear here."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {!studentId && <TableHead>Student</TableHead>}
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((i) => (
                  <TableRow key={i.id}>
                    {!studentId && (
                      <TableCell>
                        <Link
                          href={`/admin/compliance/${i.student.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {studentName(i.student)}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {i.student.enrollmentNumber}
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <StatusBadge status={i.violationType} />
                      <p className="mt-1 max-w-xs truncate text-xs text-muted-foreground">
                        {i.description}
                      </p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={i.severity} />
                    </TableCell>
                    <TableCell>{i.company?.name ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(i.incidentDate)}</TableCell>
                    <TableCell>
                      <StatusBadge status={i.status} />
                    </TableCell>
                    <TableCell>
                      {i.documentKey ? (
                        <Button asChild variant="ghost" size="sm">
                          <a
                            href={`/api/files/${encodeURIComponent(i.documentKey)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <FileText className="h-4 w-4" />
                            <span className="sr-only">View evidence</span>
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setUploadTarget(i);
                            setFile(null);
                          }}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditTarget(i);
                            setEditStatus(i.status);
                            setEditRemarks(i.adminRemarks ?? "");
                          }}
                        >
                          Manage
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Record incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!studentId && (
              <FormField label="Student" htmlFor="inc-student" required>
                <Select
                  id="inc-student"
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
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Violation type" htmlFor="inc-type" required>
                <Select
                  id="inc-type"
                  value={form.violationType}
                  onChange={(e) => setForm({ ...form, violationType: e.target.value })}
                >
                  {VIOLATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {formatStatusLabel(t)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Severity" htmlFor="inc-severity" required>
                <Select
                  id="inc-severity"
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value })}
                >
                  {INCIDENT_SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {formatStatusLabel(s)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Incident date" htmlFor="inc-date" required>
                <Input
                  id="inc-date"
                  type="date"
                  value={form.incidentDate}
                  onChange={(e) => setForm({ ...form, incidentDate: e.target.value })}
                />
              </FormField>
            </div>
            <FormField label="Description" htmlFor="inc-desc" required>
              <Textarea
                id="inc-desc"
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </FormField>
            <FormField label="Action taken" htmlFor="inc-action">
              <Textarea
                id="inc-action"
                rows={2}
                value={form.actionTaken}
                onChange={(e) => setForm({ ...form, actionTaken: e.target.value })}
              />
            </FormField>
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
              disabled={!form.studentId || form.description.length < 5 || create.isPending}
              onClick={() => {
                setFormError(null);
                create.mutate();
              }}
            >
              {create.isPending ? "Saving…" : "Record incident"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage / resolve */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage incident</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{editTarget.description}</p>
              <FormField label="Status" htmlFor="inc-edit-status">
                <Select
                  id="inc-edit-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  {INCIDENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {formatStatusLabel(s)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Admin remarks" htmlFor="inc-edit-remarks">
                <Textarea
                  id="inc-edit-remarks"
                  rows={3}
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                />
              </FormField>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button disabled={update.isPending} onClick={() => update.mutate()}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload evidence */}
      <Dialog open={!!uploadTarget} onOpenChange={(o) => !o && setUploadTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload supporting evidence</DialogTitle>
          </DialogHeader>
          <FormField label="File (PDF or image, max 10MB)" htmlFor="inc-file">
            <Input id="inc-file" type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadTarget(null)}>
              Cancel
            </Button>
            <Button disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
              {upload.isPending ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
