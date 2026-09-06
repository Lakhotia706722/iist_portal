"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  studentSkillSchema, customSkillSchema,
  SKILL_CATEGORIES, SKILL_LEVELS,
  type StudentSkillInput, type CustomSkillInput,
} from "@/lib/validations/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect as Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Plus, Trash2, Code2, Sparkles } from "lucide-react";

const LEVEL_COLORS: Record<string, "info" | "success" | "warning" | "default"> = {
  BEGINNER: "info", INTERMEDIATE: "success", ADVANCED: "warning", EXPERT: "default",
};

const CATEGORY_LABELS: Record<string, string> = {
  PROGRAMMING: "Programming", FRAMEWORKS: "Frameworks", DATABASES: "Databases",
  AI_ML: "AI / ML", TOOLS: "Tools", SOFT_SKILLS: "Soft Skills",
  LANGUAGES: "Languages", OTHER: "Other",
};

type CatalogSkillItem = { id: string; level: string; yearsExp: number | null; skill: { id: string; name: string; category: string } };
type CustomSkillItem  = { id: string; name: string; category: string; level: string; yearsExp: number | null };

async function fetchSkills() {
  const res = await fetch("/api/student/profile/skills");
  if (!res.ok) throw new Error("Failed to fetch skills");
  return res.json() as Promise<{ catalogSkills: CatalogSkillItem[]; customSkills: CustomSkillItem[] }>;
}

async function fetchCatalog(search: string) {
  const res = await fetch(`/api/admin/skills?search=${encodeURIComponent(search)}&pageSize=50`);
  if (!res.ok) throw new Error("Failed to fetch catalog");
  return res.json() as Promise<{ items: { id: string; name: string; category: string }[] }>;
}

export function SkillsClient() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<"catalog" | "custom">("catalog");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; isCustom: boolean; name: string } | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["student-skills"], queryFn: fetchSkills });
  const { data: catalog } = useQuery({
    queryKey: ["skill-catalog", catalogSearch],
    queryFn: () => fetchCatalog(catalogSearch),
    enabled: formOpen && formType === "catalog",
  });

  const catalogForm = useForm<StudentSkillInput>({
    resolver: zodResolver(studentSkillSchema) as any,
    defaultValues: { skillId: "", level: "BEGINNER" },
  });
  const customForm = useForm<CustomSkillInput>({
    resolver: zodResolver(customSkillSchema) as any,
    defaultValues: { name: "", category: "OTHER", level: "BEGINNER" },
  });

  const addMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch("/api/student/profile/skills", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(JSON.stringify(e.error)); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-skills"] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, isCustom }: { id: string; isCustom: boolean }) => {
      const url = `/api/student/profile/skills/${id}${isCustom ? "?custom=true" : ""}`;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-skills"] }); setDeleteTarget(null); },
  });

  function openForm(type: "catalog" | "custom") {
    setFormType(type); catalogForm.reset(); customForm.reset(); setFormOpen(true);
  }
  function closeForm() { setFormOpen(false); catalogForm.reset(); customForm.reset(); }

  // Group catalog skills by category
  const grouped = (data?.catalogSkills ?? []).reduce<Record<string, CatalogSkillItem[]>>((acc, s) => {
    const cat = s.skill.category;
    acc[cat] = [...(acc[cat] ?? []), s];
    return acc;
  }, {});

  if (isLoading) return <LoadingState text="Loading skills..." />;
  if (isError) return <ErrorState onRetry={refetch} />;

  const totalSkills = (data?.catalogSkills.length ?? 0) + (data?.customSkills.length ?? 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={() => openForm("catalog")}><Plus className="h-4 w-4" />Add from Catalog</Button>
        <Button variant="outline" onClick={() => openForm("custom")}><Sparkles className="h-4 w-4" />Add Custom Skill</Button>
      </div>

      {totalSkills === 0 ? (
        <EmptyState
          icon={<Code2 className="h-7 w-7 text-muted-foreground" />}
          title="No skills added yet"
          description="Add technical skills, tools, and languages to strengthen your profile."
          action={<Button size="sm" onClick={() => openForm("catalog")}><Plus className="h-4 w-4" />Add Skill</Button>}
        />
      ) : (
        <div className="space-y-4">
          {/* Catalog skills grouped by category */}
          {Object.entries(grouped).map(([cat, skills]) => (
            <Card key={cat}>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{CATEGORY_LABELS[cat] ?? cat}</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {skills.map((s) => (
                    <div key={s.id} className="group flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1.5 text-sm">
                      <span className="font-medium">{s.skill.name}</span>
                      <Badge variant={LEVEL_COLORS[s.level]} className="text-[10px] px-1.5 py-0">{s.level}</Badge>
                      {s.yearsExp && <span className="text-muted-foreground text-xs">{s.yearsExp}y</span>}
                      <button
                        onClick={() => setDeleteTarget({ id: s.id, isCustom: false, name: s.skill.name })}
                        className="ml-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                        aria-label={`Remove ${s.skill.name}`}
                      >×</button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Custom skills */}
          {(data?.customSkills.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Custom Skills</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {data!.customSkills.map((s) => (
                    <div key={s.id} className="group flex items-center gap-1.5 rounded-full border bg-amber-50 px-3 py-1.5 text-sm">
                      <Sparkles className="h-3 w-3 text-amber-500" />
                      <span className="font-medium">{s.name}</span>
                      <Badge variant={LEVEL_COLORS[s.level]} className="text-[10px] px-1.5 py-0">{s.level}</Badge>
                      <button
                        onClick={() => setDeleteTarget({ id: s.id, isCustom: true, name: s.name })}
                        className="ml-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                        aria-label={`Remove ${s.name}`}
                      >×</button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Add from Catalog Dialog */}
      <Dialog open={formOpen && formType === "catalog"} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogClose onClose={closeForm} />
          <DialogHeader><DialogTitle>Add Skill from Catalog</DialogTitle></DialogHeader>
          <form onSubmit={catalogForm.handleSubmit((v) => addMutation.mutate(v))} className="space-y-4 mt-2">
            <FormField label="Search Skill" required htmlFor="skill-search">
              <Input
                id="skill-search" placeholder="Type to search skills..."
                value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)}
              />
            </FormField>
            <FormField label="Select Skill" required error={catalogForm.formState.errors.skillId?.message} htmlFor="skill-id">
              <Select id="skill-id" {...catalogForm.register("skillId")}>
                <option value="">-- select a skill --</option>
                {(catalog?.items ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({CATEGORY_LABELS[s.category] ?? s.category})</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Proficiency Level" required error={catalogForm.formState.errors.level?.message} htmlFor="skill-level">
              <Select id="skill-level" {...catalogForm.register("level")}>
                {SKILL_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </Select>
            </FormField>
            <FormField label="Years of Experience" htmlFor="skill-years" hint="Optional">
              <Input id="skill-years" type="number" step="0.5" min="0" max="50" placeholder="e.g. 2" {...catalogForm.register("yearsExp")} />
            </FormField>
            {addMutation.error && <p className="text-sm text-destructive">{String(addMutation.error)}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              <Button type="submit" loading={addMutation.isPending}>Add Skill</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Custom Skill Dialog */}
      <Dialog open={formOpen && formType === "custom"} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogClose onClose={closeForm} />
          <DialogHeader><DialogTitle>Add Custom Skill</DialogTitle></DialogHeader>
          <form onSubmit={customForm.handleSubmit((v) => addMutation.mutate(v))} className="space-y-4 mt-2">
            <FormField label="Skill Name" required error={customForm.formState.errors.name?.message} htmlFor="custom-name">
              <Input id="custom-name" placeholder="e.g. Apache Kafka" {...customForm.register("name")} />
            </FormField>
            <FormField label="Category" required error={customForm.formState.errors.category?.message} htmlFor="custom-cat">
              <Select id="custom-cat" {...customForm.register("category")}>
                {SKILL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>)}
              </Select>
            </FormField>
            <FormField label="Proficiency Level" required htmlFor="custom-level">
              <Select id="custom-level" {...customForm.register("level")}>
                {SKILL_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </Select>
            </FormField>
            <FormField label="Years of Experience" htmlFor="custom-years" hint="Optional">
              <Input id="custom-years" type="number" step="0.5" min="0" placeholder="e.g. 1" {...customForm.register("yearsExp")} />
            </FormField>
            {addMutation.error && <p className="text-sm text-destructive">{String(addMutation.error)}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              <Button type="submit" loading={addMutation.isPending}>Add Custom Skill</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Remove Skill" description={`Remove "${deleteTarget?.name}" from your profile?`}
        confirmLabel="Remove" onConfirm={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id, isCustom: deleteTarget.isCustom })}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
