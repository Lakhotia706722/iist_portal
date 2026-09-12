"use client";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { internshipSchema, type InternshipInput } from "@/lib/validations/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Briefcase, MapPin, ExternalLink, Paperclip } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useDirectUpload } from "@/hooks/use-direct-upload";

type InternshipItem = {
  id: string; company: string; role: string; description: string | null;
  location: string | null; isRemote: boolean; startDate: string; endDate: string | null;
  isOngoing: boolean; stipend: number | null; certificateUrl: string | null;
};

async function fetchInternships() {
  const res = await fetch("/api/student/profile/internships");
  if (!res.ok) throw new Error("Failed to fetch internships");
  return res.json() as Promise<InternshipItem[]>;
}

export function InternshipsClient() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InternshipItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InternshipItem | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student-internships"], queryFn: fetchInternships,
  });

  const form = useForm<InternshipInput>({
    resolver: zodResolver(internshipSchema) as any,
    defaultValues: { company: "", role: "", description: "", location: "", isRemote: false, startDate: "", endDate: "", isOngoing: false },
  });
  const isOngoing = form.watch("isOngoing");

  const { uploadDirect } = useDirectUpload();

  const saveMutation = useMutation({
    mutationFn: async (values: InternshipInput) => {
      const url = editing ? `/api/student/profile/internships/${editing.id}` : "/api/student/profile/internships";
      // Phase 16 — P5: certificate goes straight to storage; only the key
      // is sent here.
      const fileKey = certFile ? await uploadDirect(certFile, "internships") : undefined;
      const body = JSON.stringify({ ...values, fileKey });
      const headers: HeadersInit = { "Content-Type": "application/json" };
      const res = await fetch(url, { method: editing ? "PATCH" : "POST", headers, body });
      if (!res.ok) { const e = await res.json(); throw new Error(JSON.stringify(e.error)); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-internships"] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/student/profile/internships/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-internships"] }); setDeleteTarget(null); },
  });

  function openCreate() { form.reset({ company: "", role: "", description: "", location: "", isRemote: false, startDate: "", endDate: "", isOngoing: false }); setEditing(null); setCertFile(null); setFormOpen(true); }
  function openEdit(i: InternshipItem) {
    form.reset({ company: i.company, role: i.role, description: i.description ?? "", location: i.location ?? "", isRemote: i.isRemote, startDate: i.startDate.split("T")[0], endDate: i.endDate ? i.endDate.split("T")[0] : "", isOngoing: i.isOngoing, stipend: i.stipend ?? undefined });
    setEditing(i); setCertFile(null); setFormOpen(true);
  }
  function closeForm() { setFormOpen(false); setEditing(null); setCertFile(null); form.reset(); }

  if (isLoading) return <LoadingState text="Loading experience..." />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}><Plus className="h-4 w-4" />Add Experience</Button>
      </div>

      {(data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-7 w-7 text-muted-foreground" />}
          title="No experience added yet"
          description="Add internships or work experience to your profile."
          action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />Add Experience</Button>}
        />
      ) : (
        <div className="space-y-3">
          {data!.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-start gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                  <Briefcase className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{item.role}</p>
                      <p className="text-sm text-muted-foreground">{item.company}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(item)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatDate(new Date(item.startDate))} — {item.isOngoing ? "Present" : item.endDate ? formatDate(new Date(item.endDate)) : "—"}</span>
                    {item.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{item.location}</span>}
                    {item.isRemote && <Badge variant="info" className="text-[10px]">Remote</Badge>}
                    {item.stipend && <span>₹{item.stipend.toLocaleString("en-IN")}/mo</span>}
                  </div>
                  {item.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{item.description}</p>}
                  {item.certificateUrl && (
                    <a href={item.certificateUrl} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline">
                      <Paperclip className="h-3.5 w-3.5" />View Certificate
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogClose onClose={closeForm} />
          <DialogHeader><DialogTitle>{editing ? "Edit Experience" : "Add Experience"}</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Company" required error={form.formState.errors.company?.message} htmlFor="int-co">
                <Input id="int-co" placeholder="e.g. Google" {...form.register("company")} />
              </FormField>
              <FormField label="Role / Designation" required error={form.formState.errors.role?.message} htmlFor="int-role">
                <Input id="int-role" placeholder="e.g. Software Intern" {...form.register("role")} />
              </FormField>
            </div>
            <FormField label="Description" htmlFor="int-desc">
              <Textarea id="int-desc" rows={3} placeholder="Describe your responsibilities and achievements..." {...form.register("description")} />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Location" htmlFor="int-loc">
                <Input id="int-loc" placeholder="e.g. Bengaluru" {...form.register("location")} />
              </FormField>
              <FormField label="Stipend (₹/month)" htmlFor="int-stipend">
                <Input id="int-stipend" type="number" min="0" placeholder="e.g. 20000" {...form.register("stipend")} />
              </FormField>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...form.register("isRemote")} className="rounded" />
              Remote internship / work
            </label>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Start Date" required error={form.formState.errors.startDate?.message} htmlFor="int-start">
                <Input id="int-start" type="date" {...form.register("startDate")} />
              </FormField>
              <FormField label="End Date" htmlFor="int-end">
                <Input id="int-end" type="date" disabled={isOngoing} {...form.register("endDate")} />
              </FormField>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...form.register("isOngoing")} className="rounded" />
              Currently working here
            </label>
            <FormField label="Certificate" htmlFor="int-cert" hint="PDF or image, max 5 MB (optional)">
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Paperclip className="h-4 w-4" />{certFile ? certFile.name : "Upload Certificate"}
                </Button>
                {certFile && <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => setCertFile(null)}>Remove</button>}
                <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => setCertFile(e.target.files?.[0] ?? null)} />
              </div>
            </FormField>
            {saveMutation.error && <p className="text-sm text-destructive">{String(saveMutation.error)}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              <Button type="submit" loading={saveMutation.isPending}>{editing ? "Save Changes" : "Add Experience"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Experience" description={`Delete "${deleteTarget?.role} at ${deleteTarget?.company}"?`}
        confirmLabel="Delete" onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
