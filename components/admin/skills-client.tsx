"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { skillCatalogSchema, SKILL_CATEGORIES, type SkillCatalogInput } from "@/lib/validations/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { NativeSelect as Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

type Skill = { id: string; name: string; category: string; isActive: boolean };

/**
 * Phase 12 — Admin's "Skills Catalog" nav item had a full CRUD API
 * (server/services/skill.service.ts + /api/admin/skills) since an earlier
 * phase but no UI at all. This mirrors branches-client.tsx's exact
 * dialog+table CRUD pattern.
 */
export function SkillsClient() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-skills", search, category],
    queryFn: async () => {
      const p = new URLSearchParams({ pageSize: "200", includeInactive: "true" });
      if (search) p.set("search", search);
      if (category) p.set("category", category);
      const res = await fetch(`/api/admin/skills?${p}`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ items: Skill[]; total: number }>;
    },
  });

  const form = useForm<SkillCatalogInput>({
    resolver: zodResolver(skillCatalogSchema) as any,
    defaultValues: { name: "", category: "OTHER", isActive: true },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: SkillCatalogInput) => {
      const url = editing ? `/api/admin/skills/${editing.id}` : "/api/admin/skills";
      const res = await fetch(url, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-skills"] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/skills/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-skills"] }); setDeleteTarget(null); },
  });

  function closeForm() { setFormOpen(false); setEditing(null); form.reset(); }
  function openCreate() { form.reset({ name: "", category: "OTHER", isActive: true }); setEditing(null); setFormOpen(true); }
  function openEdit(s: Skill) { form.reset({ name: s.name, category: s.category as any, isActive: s.isActive }); setEditing(s); setFormOpen(true); }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search skills..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-48" aria-label="Filter by category">
          <option value="">All categories</option>
          {SKILL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Button onClick={openCreate}><Plus className="h-4 w-4" />Add Skill</Button>
      </div>

      <Card>
        {isLoading ? <LoadingState /> : isError ? <ErrorState onRetry={refetch} /> : !data?.items.length ? (
          <EmptyState title="No skills found" action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />Add Skill</Button>} className="border-none" />
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{s.category}</code></TableCell>
                  <TableCell><Badge variant={s.isActive ? "success" : "secondary"}>{s.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(s)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? "Edit Skill" : "Add Skill"}</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4 mt-2">
            <FormField label="Name" required error={form.formState.errors.name?.message} htmlFor="sk-name">
              <Input id="sk-name" placeholder="e.g. React" {...form.register("name")} />
            </FormField>
            <FormField label="Category" required error={form.formState.errors.category?.message} htmlFor="sk-category">
              <Select id="sk-category" {...form.register("category")}>
                {SKILL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </FormField>
            <FormField label="Active" htmlFor="sk-active">
              {/* A plain register()+setValueAs boolean select relies on
                  react-hook-form applying defaultValues to the DOM on
                  mount, which native <select> elements don't reliably do
                  without an explicit interaction — Controller keeps this
                  field's displayed value tied directly to form state
                  instead, so "leave it at the default and submit" (the
                  common path — nobody touches this field on create)
                  actually submits what's shown. */}
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <Select id="sk-active" value={String(field.value)} onChange={(e) => field.onChange(e.target.value === "true")}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </Select>
                )}
              />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              <Button type="submit" loading={saveMutation.isPending}>{editing ? "Save" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} title="Deactivate Skill" description={`Deactivate "${deleteTarget?.name}"? It will be hidden from students but existing records keep it.`} confirmLabel="Deactivate" onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} loading={deleteMutation.isPending} />
    </div>
  );
}
