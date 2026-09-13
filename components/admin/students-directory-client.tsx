"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect as Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { GraduationCap, Search, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
 *
 * Phase 17 P5 — student name/row now links to the per-student detail page.
 * Phase 17 P4 — "Add Student" provisions real accounts (individual + CSV).
 */
export function StudentsDirectoryClient() {
  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [page, setPage] = useState(0);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const router = useRouter();

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
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <Button onClick={() => setShowAddDialog(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Student
        </Button>
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
                    <TableRow
                      key={s.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/admin/students/${s.id}`)}
                    >
                      <TableCell>
                        <Link href={`/admin/students/${s.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                          {s.name}
                        </Link>
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

      {showAddDialog && <AddStudentDialog onClose={() => setShowAddDialog(false)} />}
    </div>
  );
}

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface BatchOption {
  id: string;
  name: string;
  academicYear: string;
  branchId: string;
}

function AddStudentDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: branchData } = useQuery<{ items: BranchOption[] }>({
    queryKey: ["branches-list-full"],
    queryFn: async () => {
      const res = await fetch("/api/admin/branches?pageSize=200&includeInactive=false");
      return res.json();
    },
  });
  const branches = branchData?.items ?? [];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Student</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="individual">
          <TabsList>
            <TabsTrigger value="individual">Add Individually</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Upload (CSV)</TabsTrigger>
          </TabsList>
          <TabsContent value="individual">
            <IndividualStudentForm
              branches={branches}
              onCreated={() => {
                qc.invalidateQueries({ queryKey: ["admin-students-directory"] });
                onClose();
              }}
            />
          </TabsContent>
          <TabsContent value="bulk">
            <BulkStudentUpload
              onCreated={() => {
                qc.invalidateQueries({ queryKey: ["admin-students-directory"] });
                onClose();
              }}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function IndividualStudentForm({
  branches,
  onCreated,
}: {
  branches: BranchOption[];
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [enrollmentNumber, setEnrollmentNumber] = useState("");
  const [branchId, setBranchId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: batchData } = useQuery<{ items: BatchOption[] }>({
    queryKey: ["batches-for-branch", branchId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/batches?branchId=${branchId}&pageSize=100`);
      return res.json();
    },
    enabled: !!branchId,
  });
  const batches = batchData?.items ?? [];

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/students/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, enrollmentNumber, branchId, batchId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create student");
      return body;
    },
    onSuccess: () => {
      toast({
        title: "Student account created",
        description: `A set-password email has been sent to ${email}.`,
        variant: "success",
      });
      onCreated();
    },
    onError: (e: Error) => {
      setFieldErrors({});
      toast({ title: "Could not create student", description: e.message, variant: "destructive" });
    },
  });

  return (
    <form
      className="space-y-4 pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <FormField label="Full Name" htmlFor="student-name" required>
        <Input id="student-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </FormField>
      <FormField label="College Email" htmlFor="student-email" required>
        <Input id="student-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </FormField>
      <FormField label="Enrollment Number" htmlFor="student-enrollment" required>
        <Input id="student-enrollment" value={enrollmentNumber} onChange={(e) => setEnrollmentNumber(e.target.value)} required />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Branch" htmlFor="student-branch" required>
          <Select
            id="student-branch"
            value={branchId}
            onChange={(e) => { setBranchId(e.target.value); setBatchId(""); }}
            required
          >
            <option value="">Select branch</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </FormField>
        <FormField label="Batch" htmlFor="student-batch" required>
          <Select id="student-batch" value={batchId} onChange={(e) => setBatchId(e.target.value)} disabled={!branchId} required>
            <option value="">Select batch</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </FormField>
      </div>

      <p className="text-xs text-muted-foreground">
        No password is set here — the student will receive an email with a link to set their own password.
      </p>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create Student"}
        </Button>
      </div>
    </form>
  );
}

interface BulkRow {
  enrollmentNumber: string;
  name: string;
  email: string;
  branchCode: string;
  batchAcademicYear: string;
}

function BulkStudentUpload({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [raw, setRaw] = useState("");
  const [errors, setErrors] = useState<Array<{ row: number; enrollmentNumber: string; reason: string }>>([]);

  const rows = useMemo<BulkRow[]>(() => {
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [enrollmentNumber, name, email, branchCode, batchAcademicYear] = line.split(",").map((c) => c.trim());
        return { enrollmentNumber, name, email, branchCode, batchAcademicYear };
      })
      .filter((r) => r.enrollmentNumber);
  }, [raw]);

  const upload = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/students/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (Array.isArray(body.errors)) setErrors(body.errors);
        throw new Error(body.error ?? "Upload failed");
      }
      return body as { created: number };
    },
    onSuccess: (body) => {
      setErrors([]);
      setRaw("");
      toast({
        title: "Students created",
        description: `${body.created} student account(s) created. Set-password emails have been sent.`,
        variant: "success",
      });
      onCreated();
    },
    onError: (e: Error) =>
      toast({ title: "Upload rejected", description: e.message, variant: "destructive" }),
  });

  const onFile = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    // Drop a header row if present (first cell isn't an enrollment-looking value with no letters-only header words).
    const first = lines[0]?.toLowerCase();
    const looksLikeHeader = first?.includes("enrollment") || first?.includes("email");
    setRaw((looksLikeHeader ? lines.slice(1) : lines).join("\n"));
    setErrors([]);
  };

  return (
    <div className="space-y-4 pt-2">
      <FormField
        label="Upload a CSV"
        htmlFor="students-file"
        hint="Columns: enrollment number, full name, email, branch code, batch academic year (e.g. 2021-2025)."
      >
        <Input
          id="students-file"
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
        htmlFor="students-raw"
        hint="One per line: ENROLLMENT, NAME, EMAIL, BRANCH_CODE, BATCH_ACADEMIC_YEAR"
      >
        <Textarea
          id="students-raw"
          rows={8}
          className="font-mono text-xs"
          placeholder={"IIST2025CS01, Jane Doe, jane.doe@iist.ac.in, CSE, 2025-2029"}
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
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
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

      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={() => upload.mutate()} disabled={upload.isPending || rows.length === 0}>
          {upload.isPending ? "Uploading…" : `Create ${rows.length || ""} Student(s)`}
        </Button>
      </div>
    </div>
  );
}
