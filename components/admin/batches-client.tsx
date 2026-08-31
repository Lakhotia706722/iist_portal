"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { batchSchema, type BatchInput } from "@/lib/validations/admin";
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

type Batch = { id: string; name: string; academicYear: string; startYear: number; endYear: number; isActive: boolean; branch: { name: string; code: string }; _count: { students: number } };
type Branch = { id: string; name: string; code: string };

export function BatchesClient() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Batch | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["batches", search, page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/batches?search=${encodeURIComponent(search)}&page=${page}&includeInactive=true`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ items: Batch[]; total: number; totalPages: number }>;
    },
  });

  const { data: branches } = useQuery<{ items: Branch[] }>({
    queryKey: ["branches-list"],
    queryFn: async () => { const res = await fetch("/api/admin/branches?pageSize=200"); return res.json(); },
  });

  const form = useForm<BatchInput>({ resolver: zodResolver(batchSchema) as any, defaultValues: { name: "", academicYear: "", branchId: "", startYear: new Date().getFullYear(), endYear: new Date().getFullYear() + 4, isActive: true } });

  const saveMutation = useMutation({
    mutationFn: async (values: BatchInput) => {
      const url = editing ? `/api/admin/batches/${editing.id}` : "/api/admin/batches";
      const res = await fetch(url, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["batches"] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await fetch(`/api/admin/batches/${id}`, { method: "DELETE" }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["batches"] }); setDeleteTarget(null); },
  });

  function closeForm() { setFormOpen(false); setEditing(null); form.reset(); }
  function openCreate() { form.reset({ name: "", academicYear: "", branchId: "", startYear: new Date().getFullYear(), endYear: new Date().getFullYear() + 4, isActive: true }); setEditing(null); setFormOpen(true); }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search batches..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" />Add Batch</Button>
      </div>

      <Card>
        {isLoading ? <LoadingState /> : isError ? <ErrorState onRetry={refetch} /> : !data?.items.length ? (
          <EmptyState title="No batches found" action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />Add Batch</Button>} className="border-none" />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Academic Year</TableHead><TableHead>Branch</TableHead><TableHead>Students</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.items.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>{b.academicYear}</TableCell>
                  <TableCell>{b.branch.name} <span className="text-muted-foreground text-xs">({b.branch.code})</span></TableCell>
                  <TableCell>{b._count.students}</TableCell>
                  <TableCell><Badge variant={b.isActive ? "success" : "secondary"}>{b.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { form.reset({ name: b.name, academicYear: b.academicYear, branchId: "", startYear: b.startYear, endYear: b.endYear, isActive: b.isActive }); setEditing(b); setFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? "Edit Batch" : "Add Batch"}</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4 mt-2">
            <FormField label="Name" required error={form.formState.errors.name?.message} htmlFor="ba-name">
              <Input id="ba-name" placeholder="e.g. B.Tech CSE 2021-25" {...form.register("name")} />
            </FormField>
            <FormField label="Academic Year" required error={form.formState.errors.academicYear?.message} htmlFor="ba-year" hint="Format: YYYY-YYYY e.g. 2021-2025">
              <Input id="ba-year" placeholder="2021-2025" {...form.register("academicYear")} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Start Year" required error={form.formState.errors.startYear?.message} htmlFor="ba-sy">
                <Input id="ba-sy" type="number" {...form.register("startYear", { valueAsNumber: true })} />
              </FormField>
              <FormField label="End Year" required error={form.formState.errors.endYear?.message} htmlFor="ba-ey">
                <Input id="ba-ey" type="number" {...form.register("endYear", { valueAsNumber: true })} />
              </FormField>
            </div>
            <FormField label="Branch" required error={form.formState.errors.branchId?.message} htmlFor="ba-branch">
              <Select id="ba-branch" {...form.register("branchId")}>
                <option value="">Select branch...</option>
                {branches?.items.map((br) => <option key={br.id} value={br.id}>{br.name} ({br.code})</option>)}
              </Select>
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              <Button type="submit" loading={saveMutation.isPending}>{editing ? "Save" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Deactivate Batch" description={`Deactivate "${deleteTarget?.name}"?`} confirmLabel="Deactivate" onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} loading={deleteMutation.isPending} />
    </div>
  );
}
