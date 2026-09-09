"use client";

import { useMemo, useState } from "react";
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
import { BookOpen, Plus, Upload, ListChecks } from "lucide-react";
import { TEST_MODES, TEST_STATUSES } from "@/lib/validations/skillup";

type TestType = { id: string; name: string; slug: string };

type Test = {
  id: string;
  title: string;
  scheduledAt: string;
  maxMarks: number;
  passingMarks: number;
  status: string;
  mode: string;
  venue: string | null;
  testType: TestType;
  batch: { id: string; name: string; academicYear: string } | null;
  department: { id: string; name: string; code: string } | null;
  _count: { results: number; participants: number };
};

const EMPTY_TEST = {
  title: "",
  testTypeId: "",
  description: "",
  scheduledAt: "",
  durationMins: "",
  maxMarks: "100",
  passingMarks: "40",
  mode: "OFFLINE",
  venue: "",
  status: "SCHEDULED",
  batchId: "",
  departmentId: "",
};

export function AdminSkillUpClient() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_TEST);
  const [formError, setFormError] = useState<string | null>(null);
  const [newType, setNewType] = useState({ name: "", description: "" });
  const [resultsTarget, setResultsTarget] = useState<Test | null>(null);

  const testsQuery = useQuery({
    queryKey: ["admin-tests"],
    queryFn: async () => {
      const res = await fetch("/api/admin/skillup/tests?limit=100");
      if (!res.ok) throw new Error("Failed to load tests");
      return res.json() as Promise<{ tests: Test[]; total: number }>;
    },
  });

  const typesQuery = useQuery({
    queryKey: ["test-types"],
    queryFn: async () => {
      const res = await fetch("/api/admin/skillup/types");
      if (!res.ok) throw new Error("Failed to load test types");
      return res.json() as Promise<{ testTypes: TestType[] }>;
    },
  });

  const batchesQuery = useQuery({
    queryKey: ["batches"],
    queryFn: async () => {
      const res = await fetch("/api/admin/batches");
      if (!res.ok) return { batches: [] };
      const body = await res.json();
      return { batches: body.batches ?? body.items ?? [] };
    },
  });

  const createType = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/skillup/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newType.name,
          description: newType.description || null,
          sortOrder: 0,
          isActive: true,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not create category");
      return body;
    },
    onSuccess: () => {
      toast({ title: "Category created", variant: "success" });
      setTypeOpen(false);
      setNewType({ name: "", description: "" });
      qc.invalidateQueries({ queryKey: ["test-types"] });
    },
    onError: (e: Error) =>
      toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const createTest = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/skillup/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          testTypeId: form.testTypeId,
          description: form.description || null,
          scheduledAt: form.scheduledAt,
          durationMins: form.durationMins ? Number(form.durationMins) : null,
          maxMarks: Number(form.maxMarks),
          passingMarks: Number(form.passingMarks),
          mode: form.mode,
          venue: form.venue || null,
          status: form.status,
          batchId: form.batchId || null,
          departmentId: form.departmentId || null,
          studentIds: [],
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(
          body.error ?? Object.values(body.fieldErrors ?? {})[0] ?? "Could not create test"
        );
      }
      return body;
    },
    onSuccess: () => {
      toast({ title: "Test created", description: "Students in scope can now see it.", variant: "success" });
      setCreateOpen(false);
      setForm(EMPTY_TEST);
      setFormError(null);
      qc.invalidateQueries({ queryKey: ["admin-tests"] });
    },
    onError: (e: Error) => {
      setFormError(e.message);
      toast({ title: "Could not create test", description: e.message, variant: "destructive" });
    },
  });

  const tests = testsQuery.data?.tests ?? [];
  const types = typesQuery.data?.testTypes ?? [];

  if (testsQuery.isLoading) return <LoadingState text="Loading tests…" />;
  if (testsQuery.isError) return <ErrorState onRetry={() => testsQuery.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => {
            setForm({ ...EMPTY_TEST, testTypeId: types[0]?.id ?? "" });
            setFormError(null);
            setCreateOpen(true);
          }}
          disabled={types.length === 0}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create test
        </Button>
        <Button variant="outline" onClick={() => setTypeOpen(true)}>
          <ListChecks className="mr-2 h-4 w-4" />
          Add category
        </Button>
        {types.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Add an assessment category first (aptitude, coding, …).
          </p>
        )}
      </div>

      {tests.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No tests yet"
          description="Create an assessment, then upload results by enrollment number."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Results</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tests.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell>{t.testType.name}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(t.scheduledAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t._count.participants > 0
                        ? `${t._count.participants} selected`
                        : t.batch
                          ? t.batch.academicYear
                          : t.department
                            ? t.department.code
                            : "All students"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {t.passingMarks} / {t.maxMarks}
                    </TableCell>
                    <TableCell>{t._count.results}</TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setResultsTarget(t)}>
                        <Upload className="mr-1.5 h-4 w-4" />
                        Results
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Create category */}
      <Dialog open={typeOpen} onOpenChange={setTypeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add assessment category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="Name" htmlFor="type-name" required hint="e.g. Aptitude, Coding, Communication">
              <Input
                id="type-name"
                value={newType.name}
                onChange={(e) => setNewType({ ...newType, name: e.target.value })}
              />
            </FormField>
            <FormField label="Description" htmlFor="type-desc">
              <Textarea
                id="type-desc"
                value={newType.description}
                onChange={(e) => setNewType({ ...newType, description: e.target.value })}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTypeOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={newType.name.trim().length < 2 || createType.isPending}
              onClick={() => createType.mutate()}
            >
              {createType.isPending ? "Saving…" : "Add category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create test */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create test</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="Title" htmlFor="test-title" required>
              <Input
                id="test-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Category" htmlFor="test-type" required>
                <Select
                  id="test-type"
                  value={form.testTypeId}
                  onChange={(e) => setForm({ ...form, testTypeId: e.target.value })}
                >
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Date &amp; time" htmlFor="test-when" required>
                <Input
                  id="test-when"
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                />
              </FormField>

              <FormField label="Maximum marks" htmlFor="test-max" required>
                <Input
                  id="test-max"
                  type="number"
                  min="1"
                  value={form.maxMarks}
                  onChange={(e) => setForm({ ...form, maxMarks: e.target.value })}
                />
              </FormField>

              <FormField label="Passing marks" htmlFor="test-pass" required>
                <Input
                  id="test-pass"
                  type="number"
                  min="0"
                  value={form.passingMarks}
                  onChange={(e) => setForm({ ...form, passingMarks: e.target.value })}
                />
              </FormField>

              <FormField label="Duration (minutes)" htmlFor="test-dur">
                <Input
                  id="test-dur"
                  type="number"
                  min="1"
                  value={form.durationMins}
                  onChange={(e) => setForm({ ...form, durationMins: e.target.value })}
                />
              </FormField>

              <FormField label="Mode" htmlFor="test-mode">
                <Select
                  id="test-mode"
                  value={form.mode}
                  onChange={(e) => setForm({ ...form, mode: e.target.value })}
                >
                  {TEST_MODES.map((m) => (
                    <option key={m} value={m}>
                      {formatStatusLabel(m)}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Venue" htmlFor="test-venue">
                <Input
                  id="test-venue"
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                />
              </FormField>

              <FormField
                label="Batch scope"
                htmlFor="test-batch"
                hint="Leave blank to include every batch."
              >
                <Select
                  id="test-batch"
                  value={form.batchId}
                  onChange={(e) => setForm({ ...form, batchId: e.target.value })}
                >
                  <option value="">All batches</option>
                  {(batchesQuery.data?.batches ?? []).map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.academicYear})
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Status" htmlFor="test-status">
                <Select
                  id="test-status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  {TEST_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {formatStatusLabel(s)}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <FormField label="Description" htmlFor="test-desc">
              <Textarea
                id="test-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
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
              disabled={!form.title || !form.testTypeId || !form.scheduledAt || createTest.isPending}
              onClick={() => {
                setFormError(null);
                createTest.mutate();
              }}
            >
              {createTest.isPending ? "Saving…" : "Create test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {resultsTarget && (
        <ResultsDialog test={resultsTarget} onClose={() => setResultsTarget(null)} />
      )}
    </div>
  );
}

/** Result upload: paste/enter rows, or load a CSV. Unmatched rows block the save. */
function ResultsDialog({ test, onClose }: { test: Test; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [raw, setRaw] = useState("");
  const [errors, setErrors] = useState<
    Array<{ row: number; enrollmentNumber: string; reason: string }>
  >([]);

  const eligible = useQuery({
    queryKey: ["test-students", test.id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/skillup/tests/${test.id}/students`);
      if (!res.ok) throw new Error("Failed to load students");
      return res.json() as Promise<{ students: any[] }>;
    },
  });

  const existing = useQuery({
    queryKey: ["test-results", test.id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/skillup/tests/${test.id}/results`);
      if (!res.ok) throw new Error("Failed to load results");
      return res.json() as Promise<{ results: any[] }>;
    },
  });

  const rows = useMemo(() => {
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [enrollmentNumber, marks, ...rest] = line.split(/[,\t]/).map((c) => c.trim());
        return {
          enrollmentNumber,
          marksObtained: Number(marks),
          remarks: rest.join(", ") || null,
        };
      })
      .filter((r) => r.enrollmentNumber);
  }, [raw]);

  const upload = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/skillup/tests/${test.id}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (Array.isArray(body.errors)) setErrors(body.errors);
        throw new Error(body.error ?? "Upload failed");
      }
      return body as { inserted: number; updated: number };
    },
    onSuccess: (body) => {
      setErrors([]);
      setRaw("");
      toast({
        title: "Results published",
        description: `${body.inserted} added, ${body.updated} updated. Students have been notified.`,
        variant: "success",
      });
      qc.invalidateQueries({ queryKey: ["admin-tests"] });
      qc.invalidateQueries({ queryKey: ["test-results", test.id] });
    },
    onError: (e: Error) =>
      toast({ title: "Upload rejected", description: e.message, variant: "destructive" }),
  });

  const onFile = async (file: File) => {
    const text = await file.text();
    // Drop a header row if the first cell isn't an enrollment-looking value.
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const first = lines[0]?.split(/[,\t]/)[1]?.trim();
    setRaw((first !== undefined && Number.isNaN(Number(first)) ? lines.slice(1) : lines).join("\n"));
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Results — {test.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {eligible.data?.students.length ?? 0} student(s) in scope ·{" "}
            {existing.data?.results.length ?? 0} result(s) already recorded · max marks{" "}
            {test.maxMarks}
          </p>

          <FormField
            label="Upload a CSV"
            htmlFor="results-file"
            hint="Columns: enrollment number, marks, optional remarks."
          >
            <Input
              id="results-file"
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
          </FormField>

          <FormField
            label="Or enter rows manually"
            htmlFor="results-raw"
            hint="One per line: ENROLLMENT, MARKS, remarks"
          >
            <Textarea
              id="results-raw"
              rows={8}
              className="font-mono text-xs"
              placeholder={"IIST2021CS01, 78\nIIST2021CS02, 65, needs work on speed"}
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setErrors([]);
              }}
            />
          </FormField>

          {rows.length > 0 && (
            <p className="text-sm text-muted-foreground">{rows.length} row(s) parsed.</p>
          )}

          {errors.length > 0 && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/5 p-3"
            >
              <p className="text-sm font-medium text-destructive">
                Nothing was saved — fix these {errors.length} row(s) and try again:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-destructive">
                {errors.map((e, i) => (
                  <li key={i}>
                    Row {e.row} ({e.enrollmentNumber || "blank"}): {e.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(existing.data?.results.length ?? 0) > 0 && (
            <div>
              <h4 className="text-sm font-medium">Recorded results</h4>
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Marks</TableHead>
                      <TableHead>%</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(existing.data?.results ?? []).map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          {r.student.enrollmentNumber}
                          <div className="text-xs text-muted-foreground">
                            {[r.student.firstName, r.student.lastName].filter(Boolean).join(" ")}
                          </div>
                        </TableCell>
                        <TableCell>
                          {r.marksObtained}/{r.maxMarks}
                        </TableCell>
                        <TableCell>{r.percentage.toFixed(1)}%</TableCell>
                        <TableCell>
                          <StatusBadge
                            status={r.isPassed ? "PASS" : "FAIL"}
                            label={r.isPassed ? "Passed" : "Failed"}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button disabled={rows.length === 0 || upload.isPending} onClick={() => upload.mutate()}>
            {upload.isPending ? "Publishing…" : `Publish ${rows.length} result(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
