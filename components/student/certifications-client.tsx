"use client";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { certificationSchema, type CertificationInput } from "@/lib/validations/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Award, ExternalLink, Paperclip } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useDirectUpload } from "@/hooks/use-direct-upload";

type CertItem = {
  id: string; name: string; issuingOrg: string; issueDate: string;
  expiryDate: string | null; doesNotExpire: boolean; credentialId: string | null;
  credentialUrl: string | null; certificateUrl: string | null;
};

async function fetchCerts() {
  const res = await fetch("/api/student/profile/certifications");
  if (!res.ok) throw new Error("Failed to fetch certifications");
  return res.json() as Promise<CertItem[]>;
}

export function CertificationsClient() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CertItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CertItem | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["student-certs"], queryFn: fetchCerts });

  const form = useForm<CertificationInput>({
    resolver: zodResolver(certificationSchema) as any,
    defaultValues: { name: "", issuingOrg: "", issueDate: "", doesNotExpire: false, credentialId: "", credentialUrl: "" },
  });
  const doesNotExpire = form.watch("doesNotExpire");

  const { uploadDirect } = useDirectUpload();

  const saveMutation = useMutation({
    mutationFn: async (values: CertificationInput) => {
      const url = editing ? `/api/student/profile/certifications/${editing.id}` : "/api/student/profile/certifications";
      // Phase 16 — P5: the certificate goes straight to storage
      // (presigned URL) — only its key is sent to this route now.
      const fileKey = certFile ? await uploadDirect(certFile, "certifications") : undefined;
      const body = JSON.stringify({ ...values, fileKey });
      const headers: HeadersInit = { "Content-Type": "application/json" };
      const res = await fetch(url, { method: editing ? "PATCH" : "POST", headers, body });
      if (!res.ok) { const e = await res.json(); throw new Error(JSON.stringify(e.error)); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-certs"] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/student/profile/certifications/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-certs"] }); setDeleteTarget(null); },
  });

  function openCreate() { form.reset({ name: "", issuingOrg: "", issueDate: "", doesNotExpire: false, credentialId: "", credentialUrl: "" }); setEditing(null); setCertFile(null); setFormOpen(true); }
  function openEdit(c: CertItem) {
    form.reset({ name: c.name, issuingOrg: c.issuingOrg, issueDate: c.issueDate.split("T")[0], expiryDate: c.expiryDate ? c.expiryDate.split("T")[0] : "", doesNotExpire: c.doesNotExpire, credentialId: c.credentialId ?? "", credentialUrl: c.credentialUrl ?? "" });
    setEditing(c); setCertFile(null); setFormOpen(true);
  }
  function closeForm() { setFormOpen(false); setEditing(null); setCertFile(null); form.reset(); }

  if (isLoading) return <LoadingState text="Loading certifications..." />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}><Plus className="h-4 w-4" />Add Certification</Button>
      </div>

      {(data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Award className="h-7 w-7 text-muted-foreground" />}
          title="No certifications added yet"
          description="Add professional certifications and course completions."
          action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />Add Certification</Button>}
        />
      ) : (
        <div className="space-y-3">
          {data!.map((c) => {
            const expired = !c.doesNotExpire && c.expiryDate && new Date(c.expiryDate) < new Date();
            return (
              <Card key={c.id}>
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                    <Award className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{c.name}</p>
                        <p className="text-sm text-muted-foreground">{c.issuingOrg}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>Issued {formatDate(new Date(c.issueDate))}</span>
                      {c.doesNotExpire ? <Badge variant="success" className="text-[10px]">No Expiry</Badge>
                        : c.expiryDate ? <span className={expired ? "text-destructive" : ""}>Expires {formatDate(new Date(c.expiryDate))}{expired ? " (Expired)" : ""}</span> : null}
                      {c.credentialId && <span>ID: {c.credentialId}</span>}
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      {c.credentialUrl && (
                        <a href={c.credentialUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" />Verify
                        </a>
                      )}
                      {c.certificateUrl && (
                        <a href={c.certificateUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                          <Paperclip className="h-3 w-3" />Certificate
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogClose onClose={closeForm} />
          <DialogHeader><DialogTitle>{editing ? "Edit Certification" : "Add Certification"}</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4 mt-2">
            <FormField label="Certification Name" required error={form.formState.errors.name?.message} htmlFor="cert-name">
              <Input id="cert-name" placeholder="e.g. AWS Solutions Architect" {...form.register("name")} />
            </FormField>
            <FormField label="Issuing Organization" required error={form.formState.errors.issuingOrg?.message} htmlFor="cert-org">
              <Input id="cert-org" placeholder="e.g. Amazon Web Services" {...form.register("issuingOrg")} />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Issue Date" required error={form.formState.errors.issueDate?.message} htmlFor="cert-issue">
                <Input id="cert-issue" type="date" {...form.register("issueDate")} />
              </FormField>
              <FormField label="Expiry Date" htmlFor="cert-expiry">
                <Input id="cert-expiry" type="date" disabled={doesNotExpire} {...form.register("expiryDate")} />
              </FormField>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...form.register("doesNotExpire")} className="rounded" />
              This certification does not expire
            </label>
            <FormField label="Credential ID" htmlFor="cert-cred-id">
              <Input id="cert-cred-id" placeholder="e.g. ABC123XYZ" {...form.register("credentialId")} />
            </FormField>
            <FormField label="Credential URL" htmlFor="cert-cred-url" error={form.formState.errors.credentialUrl?.message}>
              <Input id="cert-cred-url" placeholder="https://..." {...form.register("credentialUrl")} />
            </FormField>
            <FormField label="Certificate File" htmlFor="cert-file" hint="PDF or image, max 5 MB (optional)">
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
              <Button type="submit" loading={saveMutation.isPending}>{editing ? "Save Changes" : "Add Certification"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Certification" description={`Delete "${deleteTarget?.name}"?`}
        confirmLabel="Delete" onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
