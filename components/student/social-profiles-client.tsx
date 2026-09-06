"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { socialProfileSchema, SOCIAL_PLATFORMS, type SocialProfileInput } from "@/lib/validations/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect as Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Plus, Trash2, ExternalLink, Globe } from "lucide-react";

const PLATFORM_LABELS: Record<string, string> = {
  LINKEDIN: "LinkedIn", GITHUB: "GitHub", PORTFOLIO: "Portfolio",
  LEETCODE: "LeetCode", CODECHEF: "CodeChef", HACKERRANK: "HackerRank",
  KAGGLE: "Kaggle", CODEFORCES: "Codeforces", CUSTOM: "Custom",
};

const PLATFORM_COLORS: Record<string, string> = {
  LINKEDIN: "bg-blue-50 text-blue-700", GITHUB: "bg-gray-100 text-gray-700",
  PORTFOLIO: "bg-violet-50 text-violet-700", LEETCODE: "bg-orange-50 text-orange-700",
  CODECHEF: "bg-amber-50 text-amber-700", HACKERRANK: "bg-green-50 text-green-700",
  KAGGLE: "bg-cyan-50 text-cyan-700", CODEFORCES: "bg-blue-50 text-blue-700",
  CUSTOM: "bg-muted text-muted-foreground",
};

type SocialItem = { id: string; platform: string; url: string; username: string | null };

async function fetchSocial() {
  const res = await fetch("/api/student/profile/social-profiles");
  if (!res.ok) throw new Error("Failed to fetch social profiles");
  return res.json() as Promise<SocialItem[]>;
}

export function SocialProfilesClient() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SocialItem | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["student-social"], queryFn: fetchSocial });

  const form = useForm<SocialProfileInput>({
    resolver: zodResolver(socialProfileSchema) as any,
    defaultValues: { platform: "LINKEDIN", url: "", username: "" },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: SocialProfileInput) => {
      const res = await fetch("/api/student/profile/social-profiles", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(JSON.stringify(e.error)); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-social"] }); setFormOpen(false); form.reset(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/student/profile/social-profiles/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-social"] }); setDeleteTarget(null); },
  });

  if (isLoading) return <LoadingState text="Loading social profiles..." />;
  if (isError) return <ErrorState onRetry={refetch} />;

  const existingPlatforms = new Set(data?.map((s) => s.platform) ?? []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { form.reset({ platform: "LINKEDIN", url: "", username: "" }); setFormOpen(true); }}>
          <Plus className="h-4 w-4" />Add Profile
        </Button>
      </div>

      {(data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Globe className="h-7 w-7 text-muted-foreground" />}
          title="No social profiles linked"
          description="Link your LinkedIn, GitHub and coding profiles."
          action={<Button size="sm" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" />Add Profile</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data!.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${PLATFORM_COLORS[s.platform] ?? PLATFORM_COLORS.CUSTOM}`}>
                  {PLATFORM_LABELS[s.platform]?.slice(0, 2) ?? "??"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{PLATFORM_LABELS[s.platform] ?? s.platform}</p>
                  {s.username && <p className="text-xs text-muted-foreground truncate">@{s.username}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary" aria-label="Open profile">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(s)} aria-label="Remove">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogClose onClose={() => setFormOpen(false)} />
          <DialogHeader><DialogTitle>Add Social Profile</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4 mt-2">
            <FormField label="Platform" required error={form.formState.errors.platform?.message} htmlFor="social-plat">
              <Select id="social-plat" {...form.register("platform")}>
                {SOCIAL_PLATFORMS.map((p) => (
                  <option key={p} value={p} disabled={existingPlatforms.has(p) && p !== "CUSTOM"}>
                    {PLATFORM_LABELS[p]}{existingPlatforms.has(p) && p !== "CUSTOM" ? " (already added)" : ""}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Profile URL" required error={form.formState.errors.url?.message} htmlFor="social-url">
              <Input id="social-url" placeholder="https://linkedin.com/in/yourname" {...form.register("url")} />
            </FormField>
            <FormField label="Username" htmlFor="social-user" hint="Optional — shown on profile cards">
              <Input id="social-user" placeholder="yourname" {...form.register("username")} />
            </FormField>
            {saveMutation.error && <p className="text-sm text-destructive">{String(saveMutation.error)}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" loading={saveMutation.isPending}>Save Profile</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Remove Social Profile" description={`Remove your ${PLATFORM_LABELS[deleteTarget?.platform ?? ""] ?? deleteTarget?.platform} profile?`}
        confirmLabel="Remove" onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
