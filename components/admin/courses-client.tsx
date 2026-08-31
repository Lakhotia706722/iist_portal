"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { courseSchema, type CourseInput } from "@/lib/validations/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

type Course = { id: string; name: string; code: string; durationYears: number; isActive: boolean };

export function CoursesClient() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["courses", search, page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/courses?search=${encodeURIComponent(search)}&page=${page}&includeInactive=true`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ items: Course[]; total: number; totalPages: number }>;
    },
  });

  const form = useForm<CourseInput>({ resolver: zodResolver(courseSchema) as any, defaultValues: { name: "", code: "", durationYears: 4, isActive: true } });

  const saveMutation = useMutation({
    mutationFn: async (values: CourseInput) => {
      const url = editing ? `/api/admin/courses/${editing.id}` : "/api/admin/courses";
      const res = await fetch(url, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["courses"] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await fetch(`/api/admin/courses/${id}`, { method: "DELETE" }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["courses"] }); setDeleteTarget(null); },
  });

  function openCreate() { form.reset({ name: "", code: "", durationYears: 4, isActive: true }); setEditing(null); setFormOpen(true); }
  function openEdit(c: Course) { form.reset({ name: c.name, code: c.code, durationYears: c.durationYears, isActive: c.isActive }); setEditing(c); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditing(null); form.reset(); }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search courses..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" />Add Course</Button>
      </div>

      <Card>
        {isLoading ? <LoadingState /> : isError ? <ErrorState onRetry={refetch} /> : !data?.items.length ? (
          <EmptyState title="No courses found" action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />Add Course</Button>} className="border-none" />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Duration</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{c.code}</code></TableCell>
                  <TableCell>{c.durationYears} years</TableCell>
                  <TableCell><Badge variant={c.isActive ? "success" : "secondary"}>{c.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? "Edit Course" : "Add Course"}</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4 mt-2">
            <FormField label="Name" required error={form.formState.errors.name?.message} htmlFor="c-name">
              <Input id="c-name" placeholder="e.g. Bachelor of Technology" {...form.register("name")} />
            </FormField>
            <FormField label="Code" required error={form.formState.errors.code?.message} htmlFor="c-code">
              <Input id="c-code" placeholder="BTECH" {...form.register("code")} />
            </FormField>
            <FormField label="Duration (years)" required error={form.formState.errors.durationYears?.message} htmlFor="c-dur">
              <Select id="c-dur" {...form.register("durationYears", { valueAsNumber: true })}>
                {[2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>{y} years</option>)}
              </Select>
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              <Button type="submit" loading={saveMutation.isPending}>{editing ? "Save" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Deactivate Course" description={`Deactivate "${deleteTarget?.name}"?`} confirmLabel="Deactivate" onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} loading={deleteMutation.isPending} />
    </div>
  );
}
