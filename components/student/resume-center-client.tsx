"use client";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resumeSchema, type ResumeInput } from "@/lib/validations/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import {
  Plus, FileText, Pencil, Trash2, Upload, Sparkles,
  Download, Clock, ChevronDown, ChevronUp, Star,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useDirectUpload } from "@/hooks/use-direct-upload";

type ResumeVersion = { id: string; version: number; isGenerated: boolean; notes: string | null; fileUrl: string | null; createdAt: string };
type ResumeItem = { id: string; name: string; isDefault: boolean; createdAt: string; updatedAt: string; versions: ResumeVersion[]; _count: { versions: number } };

async function fetchResumes() {
  const res = await fetch("/api/student/resumes");
  if (!res.ok) throw new Error("Failed to fetch resumes");
  return res.json() as Promise<ResumeItem[]>;
}
async function fetchVersions(resumeId: string) {
  const res = await fetch(`/api/student/resumes/${resumeId}/versions`);
  if (!res.ok) throw new Error("Failed to fetch versions");
  return res.json() as Promise<ResumeVersion[]>;
}

export function ResumeCenterClient() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ResumeItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ResumeItem | null>(null);
  const [uploadResumeId, setUploadResumeId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [versionNotes, setVersionNotes] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["student-resumes"], queryFn: fetchResumes });
  const { data: versions, isLoading: vLoading } = useQuery({
    queryKey: ["resume-versions", expandedId],
    queryFn: () => fetchVersions(expandedId!),
    enabled: !!expandedId,
  });

  const form = useForm<ResumeInput>({
    resolver: zodResolver(resumeSchema) as any,
    defaultValues: { name: "", isDefault: false },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: ResumeInput) => {
      const url = editing ? `/api/student/resumes/${editing.id}` : "/api/student/resumes";
      const res = await fetch(url, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      if (!res.ok) { const e = await res.json(); throw new Error(JSON.stringify(e.error)); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-resumes"] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/student/resumes/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-resumes"] }); setDeleteTarget(null); },
  });

  const { uploadDirect } = useDirectUpload();

  const uploadVersionMutation = useMutation({
    mutationFn: async ({ resumeId, file, notes }: { resumeId: string; file: File | null; notes: string }) => {
      if (file) {
        // Phase 16 — P5: PDF goes straight to storage (presigned URL),
        // never through this Next.js route — only the resulting key does.
        const key = await uploadDirect(file, "resumes");
        const res = await fetch(`/api/student/resumes/${resumeId}/versions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, notes }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Upload failed"); }
        return res.json();
      } else {
        // generate from profile
        const res = await fetch(`/api/student/resumes/${resumeId}/versions?source=profile`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Generate failed"); }
        return res.json();
      }
    },
    onSuccess: (_, { resumeId }) => {
      qc.invalidateQueries({ queryKey: ["student-resumes"] });
      qc.invalidateQueries({ queryKey: ["resume-versions", resumeId] });
      setUploadResumeId(null); setPdfFile(null); setVersionNotes("");
    },
  });

  function openCreate() { form.reset({ name: "", isDefault: (data?.length ?? 0) === 0 }); setEditing(null); setFormOpen(true); }
  function openEdit(r: ResumeItem) { form.reset({ name: r.name, isDefault: r.isDefault }); setEditing(r); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditing(null); form.reset(); }

  if (isLoading) return <LoadingState text="Loading resumes..." />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}><Plus className="h-4 w-4" />New Resume</Button>
      </div>

      {(data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<FileText className="h-7 w-7 text-muted-foreground" />}
          title="No resumes yet"
          description="Create named resumes, upload PDFs, or generate from your profile. Every save creates a new version — nothing is ever overwritten."
          action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />Create Resume</Button>}
        />
      ) : (
        <div className="space-y-4">
          {data!.map((resume) => (
            <Card key={resume.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-5 w-5 shrink-0 text-primary" />
                    <CardTitle className="text-base truncate">{resume.name}</CardTitle>
                    {resume.isDefault && <Badge variant="success" className="gap-1 shrink-0"><Star className="h-3 w-3" />Default</Badge>}
                    <Badge variant="secondary" className="shrink-0">{resume._count.versions} version{resume._count.versions !== 1 ? "s" : ""}</Badge>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setUploadResumeId(resume.id)}>
                      <Upload className="h-3.5 w-3.5" />Add Version
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(resume)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(resume)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground pl-7">Updated {formatDate(new Date(resume.updatedAt))}</p>
              </CardHeader>

              {/* Latest version quick actions */}
              {resume.versions[0] && (
                <CardContent className="pt-0 pb-3">
                  <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">v{resume.versions[0].version} — {resume.versions[0].isGenerated ? "Generated from profile" : "Uploaded PDF"}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(new Date(resume.versions[0].createdAt))}{resume.versions[0].notes ? ` · ${resume.versions[0].notes}` : ""}</p>
                    </div>
                    {resume.versions[0].fileUrl && (
                      <a href={resume.versions[0].fileUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5" />Download</Button>
                      </a>
                    )}
                  </div>

                  {/* Version history toggle */}
                  {resume._count.versions > 1 && (
                    <button
                      onClick={() => setExpandedId(expandedId === resume.id ? null : resume.id)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mt-2 pl-1"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      {expandedId === resume.id ? "Hide" : "Show"} version history
                      {expandedId === resume.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  )}

                  {expandedId === resume.id && (
                    <div className="mt-2 space-y-1 border-t pt-2">
                      {vLoading ? <p className="text-xs text-muted-foreground px-1">Loading history...</p> : (
                        versions?.map((v) => (
                          <div key={v.id} className="flex items-center justify-between gap-3 rounded px-2 py-1.5 hover:bg-muted/40">
                            <div>
                              <span className="text-xs font-medium">v{v.version}</span>
                              <span className="text-xs text-muted-foreground ml-2">{v.isGenerated ? "Generated" : "Uploaded"} · {formatDate(new Date(v.createdAt))}</span>
                              {v.notes && <span className="text-xs text-muted-foreground ml-2">— {v.notes}</span>}
                            </div>
                            {v.fileUrl && (
                              <a href={v.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                                <Download className="h-3 w-3" />Download
                              </a>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Resume dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogClose onClose={closeForm} />
          <DialogHeader><DialogTitle>{editing ? "Rename Resume" : "New Resume"}</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4 mt-2">
            <FormField label="Resume Name" required error={form.formState.errors.name?.message} htmlFor="res-name" hint="e.g. Software Dev Resume, Core Engineering">
              <Input id="res-name" placeholder="My Resume" {...form.register("name")} />
            </FormField>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...form.register("isDefault")} className="rounded" />
              Set as default resume
            </label>
            {saveMutation.error && <p className="text-sm text-destructive">{String(saveMutation.error)}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              <Button type="submit" loading={saveMutation.isPending}>{editing ? "Save" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload / Generate version dialog */}
      <Dialog open={!!uploadResumeId} onOpenChange={(o) => !o && setUploadResumeId(null)}>
        <DialogContent className="max-w-md">
          <DialogClose onClose={() => setUploadResumeId(null)} />
          <DialogHeader><DialogTitle>Add New Version</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">Every save creates a new version — previous versions are never deleted.</p>
            <FormField label="Version Notes" htmlFor="ver-notes" hint="Optional description for this version">
              <Input id="ver-notes" placeholder="e.g. Updated for SDE roles" value={versionNotes} onChange={(e) => setVersionNotes(e.target.value)} />
            </FormField>

            {/* Option A: Upload PDF */}
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-sm font-medium">Upload PDF</p>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" />{pdfFile ? pdfFile.name : "Choose PDF"}
                </Button>
                {pdfFile && <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => setPdfFile(null)}>Remove</button>}
                <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} />
              </div>
              <Button
                size="sm" disabled={!pdfFile} loading={uploadVersionMutation.isPending && !!pdfFile}
                onClick={() => uploadResumeId && uploadVersionMutation.mutate({ resumeId: uploadResumeId, file: pdfFile, notes: versionNotes })}
              >
                <Upload className="h-4 w-4" />Upload PDF Version
              </Button>
            </div>

            {/* Option B: Generate from profile */}
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-sm font-medium">Generate from Profile</p>
              <p className="text-xs text-muted-foreground">Takes a snapshot of your current profile data — skills, projects, internships, certifications and achievements.</p>
              <Button
                size="sm" variant="outline" loading={uploadVersionMutation.isPending && !pdfFile}
                onClick={() => uploadResumeId && uploadVersionMutation.mutate({ resumeId: uploadResumeId, file: null, notes: versionNotes })}
              >
                <Sparkles className="h-4 w-4" />Generate from Profile
              </Button>
            </div>

            {uploadVersionMutation.error && <p className="text-sm text-destructive">{String(uploadVersionMutation.error)}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadResumeId(null)}>Close</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Resume" description={`Delete "${deleteTarget?.name}" and all its versions? This cannot be undone.`}
        confirmLabel="Delete All Versions" onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
