"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { departmentSchema, type DepartmentInput } from "@/lib/validations/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search, Building2 } from "lucide-react";

type Dept = { id: string; name: string; code: string; description: string | null; isActive: boolean; _count: { branches: number } };

async function fetchDepts(search: string, page: number) {
  const res = await fetch(`/api/admin/departments?search=${encodeURIComponent(search)}&page=${page}&pageSize=15&includeInactive=true`);
  if (!res.ok) throw new Error("Failed to fetch departments");
  return res.json() as Promise<{ items: Dept[]; total: number; totalPages: number }>;
}

export function DepartmentsClient() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Dept | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Dept | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["departments", search, page],
    queryFn: () => fetchDepts(search, page),
  });

  const form = useForm<DepartmentInput>({
    resolver: zodResolver(departmentSchema) as any,
    defaultValues: { name: "", code: "", description: "", isActive: true },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: DepartmentInput) => {
      const url = editing ? `/api/admin/departments/${editing.id}` : "/api/admin/departments";
      const res = await fetch(url, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      if (!res.ok) { const e = await res.json(); throw new Error(JSON.stringify(e.error)); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments"] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/departments/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments"] }); setDeleteTarget(null); },
  });

  function openCreate() { form.reset({ name: "", code: "", description: "", isActive: true }); setEditing(null); setFormOpen(true); }
  function openEdit(d: Dept) { form.reset({ name: d.name, code: d.code, description: d.description ?? "", isActive: d.isActive }); setEditing(d); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditing(null); form.reset(); }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search departments..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" />Add Department</Button>
      </div>

      <Card>
        {isLoading ? <LoadingState /> : isError ? <ErrorState onRetry={refetch} /> : !data?.items.length ? (
          <EmptyState icon={<Building2 className="h-7 w-7 text-muted-foreground" />} title="No departments found" description="Add your first department to get started." action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />Add Department</Button>} className="border-none" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Branches</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{d.code}</code></TableCell>
                    <TableCell>{d._count.branches}</TableCell>
                    <TableCell><Badge variant={d.isActive ? "success" : "secondary"}>{d.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(d)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">Total: {data.total}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                  <span className="flex items-center text-sm text-muted-foreground px-2">{page} / {data.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogClose onClose={closeForm} />
          <DialogHeader><DialogTitle>{editing ? "Edit Department" : "Add Department"}</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4 mt-2">
            <FormField label="Name" required error={form.formState.errors.name?.message} htmlFor="dept-name">
              <Input id="dept-name" placeholder="e.g. Computer Science & Engineering" {...form.register("name")} />
            </FormField>
            <FormField label="Code" required error={form.formState.errors.code?.message} htmlFor="dept-code" hint="Uppercase alphanumeric">
              <Input id="dept-code" placeholder="CSE" {...form.register("code")} />
            </FormField>
            <FormField label="Description" htmlFor="dept-desc">
              <Textarea id="dept-desc" rows={3} {...form.register("description")} />
            </FormField>
            {saveMutation.error && <p className="text-sm text-destructive">{String(saveMutation.error)}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              <Button type="submit" loading={saveMutation.isPending}>{editing ? "Save Changes" : "Create Department"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Delete Department" description={`Deactivate "${deleteTarget?.name}"?`} confirmLabel="Deactivate" onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} loading={deleteMutation.isPending} />
    </div>
  );
}
