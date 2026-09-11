"use client";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { achievementSchema, ACHIEVEMENT_TYPES, type AchievementInput } from "@/lib/validations/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect as Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Trophy, Paperclip } from "lucide-react";
import { formatDate } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  HACKATHON: "Hackathon", COMPETITION: "Competition", ACADEMIC: "Academic",
  SPORTS: "Sports", LEADERSHIP: "Leadership", AWARD: "Award",
  RESEARCH: "Research", EXTRACURRICULAR: "Extracurricular",
};

const TYPE_COLORS: Record<string, "default" | "info" | "success" | "warning"> = {
  HACKATHON: "default", COMPETITION: "info", ACADEMIC: "success",
  SPORTS: "warning", LEADERSHIP: "default", AWARD: "success",
  RESEARCH: "info", EXTRACURRICULAR: "warning",
};

type AchItem = {
  id: string; type: string; title: string; description: string | null;
  date: string | null; position: string | null; organizer: string | null; certificateUrl: string | null;
};

async function fetchAchievements() {
  const res = await fetch("/api/student/profile/achievements");
  if (!res.ok) throw new Error("Failed to fetch achievements");
  return res.json() as Promise<AchItem[]>;
}

export function AchievementsClient() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AchItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AchItem | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["student-achievements"], queryFn: fetchAchievements });

  const form = useForm<AchievementInput>({
    resolver: zodResolver(achievementSchema) as any,
    defaultValues: { type: "HACKATHON", title: "", description: "", date: "", position: "", organizer: "" },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: AchievementInput) => {
      const url = editing ? `/api/student/profile/achievements/${editing.id}` : "/api/student/profile/achievements";
      let body: BodyInit; let headers: HeadersInit | undefined;
      if (certFile) { const fd = new FormData(); fd.append("data", JSON.stringify(values)); fd.append("certificate", certFile); body = fd; }
      else { body = JSON.stringify(values); headers = { "Content-Type": "application/json" }; }
      const res = await fetch(url, { method: editing ? "PATCH" : "POST", headers, body });
      if (!res.ok) { const e = await res.json(); throw new Error(JSON.stringify(e.error)); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-achievements"] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/student/profile/achievements/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-achievements"] }); setDeleteTarget(null); },
  });

  function openCreate() { form.reset({ type: "HACKATHON", title: "", description: "", date: "", position: "", organizer: "" }); setEditing(null); setCertFile(null); setFormOpen(true); }
  function openEdit(a: AchItem) {
    form.reset({ type: a.type as any, title: a.title, description: a.description ?? "", date: a.date ? a.date.split("T")[0] : "", position: a.position ?? "", organizer: a.organizer ?? "" });
    setEditing(a); setCertFile(null); setFormOpen(true);
  }
  function closeForm() { setFormOpen(false); setEditing(null); setCertFile(null); form.reset(); }

  if (isLoading) return <LoadingState text="Loading achievements..." />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}><Plus className="h-4 w-4" />Add Achievement</Button>
      </div>

      {(data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Trophy className="h-7 w-7 text-muted-foreground" />}
          title="No achievements added yet"
          description="Highlight your hackathons, awards and extracurricular wins."
          action={<Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />Add Achievement</Button>}
        />
      ) : (
        <div className="space-y-3">
          {data!.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-start gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                  <Trophy className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{a.title}</p>
                      <Badge variant={TYPE_COLORS[a.type]} className="text-[10px]">{TYPE_LABELS[a.type]}</Badge>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(a)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {a.date && <span>{formatDate(new Date(a.date))}</span>}
                    {a.position && <span className="font-medium text-foreground">{a.position}</span>}
                    {a.organizer && <span>{a.organizer}</span>}
                  </div>
                  {a.description && <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{a.description}</p>}
                  {a.certificateUrl && (
                    <a href={a.certificateUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <Paperclip className="h-3 w-3" />Certificate
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogClose onClose={closeForm} />
          <DialogHeader><DialogTitle>{editing ? "Edit Achievement" : "Add Achievement"}</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4 mt-2">
            <FormField label="Type" required error={form.formState.errors.type?.message} htmlFor="ach-type">
              <Select id="ach-type" {...form.register("type")}>
                {ACHIEVEMENT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </Select>
            </FormField>
            <FormField label="Title" required error={form.formState.errors.title?.message} htmlFor="ach-title">
              <Input id="ach-title" placeholder="e.g. 1st Place — Smart India Hackathon 2024" {...form.register("title")} />
            </FormField>
            <FormField label="Description" htmlFor="ach-desc">
              <Textarea id="ach-desc" rows={3} placeholder="Brief description of the achievement..." {...form.register("description")} />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Date" htmlFor="ach-date">
                <Input id="ach-date" type="date" {...form.register("date")} />
              </FormField>
              <FormField label="Position / Rank" htmlFor="ach-pos">
                <Input id="ach-pos" placeholder="e.g. 1st Place" {...form.register("position")} />
              </FormField>
            </div>
            <FormField label="Organizer" htmlFor="ach-org">
              <Input id="ach-org" placeholder="e.g. Ministry of Education, AICTE" {...form.register("organizer")} />
            </FormField>
            <FormField label="Certificate" htmlFor="ach-cert" hint="PDF or image, max 5 MB (optional)">
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
              <Button type="submit" loading={saveMutation.isPending}>{editing ? "Save Changes" : "Add Achievement"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Achievement" description={`Delete "${deleteTarget?.title}"?`}
        confirmLabel="Delete" onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
