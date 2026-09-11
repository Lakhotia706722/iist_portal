"use client";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectSchema, type ProjectInput } from "@/lib/validations/profile";
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
import { Plus, Pencil, Trash2, GitBranch, ExternalLink, FolderGit2, X, Image as ImageIcon } from "lucide-react";
import NextImage from "next/image";
import { formatDate } from "@/lib/utils";

type ProjectItem = {
  id: string; title: string; description: string; techStack: string[];
  startDate: string | null; endDate: string | null; isOngoing: boolean;
  githubUrl: string | null; liveUrl: string | null; imageUrl: string | null;
};

async function fetchProjects() {
  const res = await fetch("/api/student/profile/projects");
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json() as Promise<ProjectItem[]>;
}

export function ProjectsClient() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectItem | null>(null);
  const [techInput, setTechInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["student-projects"], queryFn: fetchProjects });

  const form = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema) as any,
    defaultValues: { title: "", description: "", techStack: [], isOngoing: false, githubUrl: "", liveUrl: "" },
  });
  const techStack = form.watch("techStack") as string[];
  const isOngoing = form.watch("isOngoing");

  const saveMutation = useMutation({
    mutationFn: async (values: ProjectInput) => {
      const url = editing ? `/api/student/profile/projects/${editing.id}` : "/api/student/profile/projects";
      const method = editing ? "PATCH" : "POST";
      let body: BodyInit;
      let headers: HeadersInit | undefined;

      if (imageFile) {
        const fd = new FormData();
        fd.append("data", JSON.stringify(values));
        fd.append("image", imageFile);
        body = fd;
      } else {
        body = JSON.stringify(values);
        headers = { "Content-Type": "application/json" };
      }

      const res = await fetch(url, { method, headers, body });
      if (!res.ok) { const e = await res.json(); throw new Error(JSON.stringify(e.error)); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-projects"] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/student/profile/projects/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-projects"] }); setDeleteTarget(null); },
  });

  function openCreate() {
    form.reset({ title: "", description: "", techStack: [], isOngoing: false, githubUrl: "", liveUrl: "" });
    setEditing(null); setImageFile(null); setFormOpen(true);
  }
  function openEdit(p: ProjectItem) {
    form.reset({
      title: p.title, description: p.description, techStack: p.techStack,
      startDate: p.startDate ? p.startDate.split("T")[0] : "",
      endDate: p.endDate ? p.endDate.split("T")[0] : "",
      isOngoing: p.isOngoing, githubUrl: p.githubUrl ?? "", liveUrl: p.liveUrl ?? "",
    });
    setEditing(p); setImageFile(null); setFormOpen(true);
  }
  function closeForm() { setFormOpen(false); setEditing(null); setImageFile(null); form.reset(); }

  function addTech() {
    const t = techInput.trim();
    if (!t || techStack.includes(t)) return;
    form.setValue("techStack", [...techStack, t]);
    setTechInput("");
  }
  function removeTech(t: string) { form.setValue("techStack", techStack.filter((x) => x !== t)); }

  if (isLoading) return <LoadingState text="Loading projects..." />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}><Plus className="h-4 w-4" />Add Project</Button>
      </div>

      {(data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<FolderGit2 className="h-7 w-7 text-muted-foreground" />}
          title="No projects added yet"
          description="Add projects to demonstrate your technical abilities."
          action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />Add Project</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data!.map((p) => (
            <Card key={p.id} className="flex flex-col">
              {p.imageUrl && (
                <div className="relative h-36 overflow-hidden rounded-t-xl bg-muted">
                  {/* unoptimized: see ARCHITECTURE.md §13 — p.imageUrl is a student-uploaded
                      file whose declared MIME type isn't server-verified against actual bytes. */}
                  <NextImage
                    src={p.imageUrl}
                    alt={p.title}
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}
              <CardContent className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold leading-tight">{p.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.startDate ? formatDate(new Date(p.startDate)) : ""}{" "}
                      {p.isOngoing ? "— Present" : p.endDate ? `— ${formatDate(new Date(p.endDate))}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                <div className="flex flex-wrap gap-1">
                  {p.techStack.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                </div>
                <div className="mt-auto flex gap-3 pt-1">
                  {p.githubUrl && (
                    <a href={p.githubUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <GitBranch className="h-3.5 w-3.5" />GitHub
                    </a>
                  )}
                  {p.liveUrl && (
                    <a href={p.liveUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <ExternalLink className="h-3.5 w-3.5" />Live
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
          <DialogHeader><DialogTitle>{editing ? "Edit Project" : "Add Project"}</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4 mt-2">
            <FormField label="Title" required error={form.formState.errors.title?.message} htmlFor="proj-title">
              <Input id="proj-title" placeholder="e.g. Placement Portal" {...form.register("title")} />
            </FormField>
            <FormField label="Description" required error={form.formState.errors.description?.message} htmlFor="proj-desc">
              <Textarea id="proj-desc" rows={4} placeholder="Describe what you built, the problem it solves, your role..." {...form.register("description")} />
            </FormField>

            {/* Tech stack */}
            <FormField label="Tech Stack" required error={form.formState.errors.techStack?.message as string | undefined} htmlFor="proj-tech">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input id="proj-tech" placeholder="e.g. React" value={techInput} onChange={(e) => setTechInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTech(); } }} />
                  <Button type="button" variant="outline" size="sm" onClick={addTech}>Add</Button>
                </div>
                {techStack.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {techStack.map((t) => (
                      <span key={t} className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                        {t}<button type="button" onClick={() => removeTech(t)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Start Date" htmlFor="proj-start">
                <Input id="proj-start" type="date" {...form.register("startDate")} />
              </FormField>
              <FormField label="End Date" htmlFor="proj-end">
                <Input id="proj-end" type="date" disabled={isOngoing} {...form.register("endDate")} />
              </FormField>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...form.register("isOngoing")} className="rounded" />
              Currently working on this project
            </label>

            <FormField label="GitHub URL" htmlFor="proj-github" error={form.formState.errors.githubUrl?.message}>
              <Input id="proj-github" placeholder="https://github.com/..." {...form.register("githubUrl")} />
            </FormField>
            <FormField label="Live / Demo URL" htmlFor="proj-live" error={form.formState.errors.liveUrl?.message}>
              <Input id="proj-live" placeholder="https://..." {...form.register("liveUrl")} />
            </FormField>

            {/* Image upload */}
            <FormField label="Project Image" htmlFor="proj-image" hint="JPEG or PNG, max 2 MB (optional)">
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon className="h-4 w-4" />
                  {imageFile ? imageFile.name : "Upload Image"}
                </Button>
                {imageFile && (
                  <button type="button" onClick={() => setImageFile(null)} className="text-muted-foreground hover:text-destructive text-xs">Remove</button>
                )}
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
              </div>
            </FormField>

            {saveMutation.error && <p className="text-sm text-destructive">{String(saveMutation.error)}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              <Button type="submit" loading={saveMutation.isPending}>{editing ? "Save Changes" : "Add Project"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Project" description={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete" onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
