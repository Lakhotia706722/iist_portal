"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { branchSchema, type BranchInput } from "@/lib/validations/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

type Branch = { id: string; name: string; code: string; isActive: boolean; department: { name: string }; course: { name: string }; _count: { students: number } };
type Dept = { id: string; name: string };
type Course = { id: string; name: string };

export function BranchesClient() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["branches", search, page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/branches?search=${encodeURIComponent(search)}&page=${page}&includeInactive=true`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ items: Branch[]; total: number; totalPages: number }>;
    },
  });

  const { data: depts } = useQuery<{ items: Dept[] }>({
    queryKey: ["departments-list"],
    queryFn: async () => { const res = await fetch("/api/admin/departments?pageSize=100&includeInactive=false"); return res.json(); },
  });
  const { data: courses } = useQuery<{ items: Course[] }>({
    queryKey: ["courses-list"],
    queryFn: async () => { const res = await fetch("/api/admin/courses?pageSize=100"); return res.json(); },
  });

  const form = useForm<BranchInput>({ resolver: zodResolver(branchSchema) as any, defaultValues: { name: "", code: "", departmentId: "", courseId: "", isActive: true } });

  const saveMutation = useMutation({
    mutationFn: async (values: BranchInput) => {
      const url = editing ? `/api/admin/branches/${editing.id}` : "/api/admin/branches";
      const res = await fetch(url, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["branches"] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await fetch(`/api/admin/branches/${id}`, { method: "DELETE" }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["branches"] }); setDeleteTarget(null); },
  });

  function closeForm() { setFormOpen(false); setEditing(null); form.reset(); }
  function openCreate() { form.reset({ name: "", code: "", departmentId: "", courseId: "", isActive: true }); setEditing(null); setFormOpen(true); }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search branches..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" />Add Branch</Button>
      </div>

      <Card>
        {isLoading ? <LoadingState /> : isError ? <ErrorState onRetry={refetch} /> : !data?.items.length ? (
          <EmptyState title="No branches found" action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />Add Branch</Button>} className="border-none" />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Department</TableHead><TableHead>Course</TableHead><TableHead>Students</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.items.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{b.code}</code></TableCell>
                  <TableCell>{b.department.name}</TableCell>
                  <TableCell>{b.course.name}</TableCell>
                  <TableCell>{b._count.students}</TableCell>
                  <TableCell><Badge variant={b.isActive ? "success" : "secondary"}>{b.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { form.reset({ name: b.name, code: b.code, departmentId: "", courseId: "", isActive: b.isActive }); setEditing(b); setFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(b)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogClose onClose={closeForm} />
          <DialogHeader><DialogTitle>{editing ? "Edit Branch" : "Add Branch"}</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4 mt-2">
            <FormField label="Name" required error={form.formState.errors.name?.message} htmlFor="br-name">
              <Input id="br-name" placeholder="e.g. Computer Science & Engineering" {...form.register("name")} />
            </FormField>
            <FormField label="Code" required error={form.formState.errors.code?.message} htmlFor="br-code">
              <Input id="br-code" placeholder="CSE" {...form.register("code")} />
            </FormField>
            <FormField label="Department" required error={form.formState.errors.departmentId?.message} htmlFor="br-dept">
              <Select id="br-dept" {...form.register("departmentId")}>
                <option value="">Select department...</option>
                {depts?.items.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Course" required error={form.formState.errors.courseId?.message} htmlFor="br-course">
              <Select id="br-course" {...form.register("courseId")}>
                <option value="">Select course...</option>
                {courses?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              <Button type="submit" loading={saveMutation.isPending}>{editing ? "Save" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Deactivate Branch" description={`Deactivate "${deleteTarget?.name}"?`} confirmLabel="Deactivate" onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} loading={deleteMutation.isPending} />
    </div>
  );
}
