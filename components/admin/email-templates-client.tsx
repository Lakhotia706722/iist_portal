"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Mail, RotateCcw, Save } from "lucide-react";

type Template = {
  key: string;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
  variables: string[];
  isActive: boolean;
  isCustomised: boolean;
};

export function EmailTemplatesClient() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; subject: string; bodyHtml: string } | null>(
    null
  );
  const [confirmReset, setConfirmReset] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const res = await fetch("/api/admin/email-templates");
      if (!res.ok) throw new Error("Failed to load templates");
      return res.json() as Promise<{ templates: Template[] }>;
    },
  });

  const templates = data?.templates ?? [];
  const selected = templates.find((t) => t.key === selectedKey) ?? null;

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/email-templates/${selected!.key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft!.name,
          subject: draft!.subject,
          bodyHtml: draft!.bodyHtml,
          description: selected!.description,
          variables: selected!.variables,
          isActive: true,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save template");
      return body;
    },
    onSuccess: () => {
      toast({
        title: "Template saved",
        description: "New emails of this type will use your version.",
        variant: "success",
      });
      qc.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (e: Error) =>
      toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const reset = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/email-templates/${selected!.key}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not reset template");
      return body;
    },
    onSuccess: () => {
      toast({ title: "Template reset to default", variant: "success" });
      setConfirmReset(false);
      setDraft(null);
      setSelectedKey(null);
      qc.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (e: Error) =>
      toast({ title: "Reset failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <LoadingState text="Loading templates…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Template list */}
      <Card className="h-fit p-2">
        <ul className="space-y-0.5">
          {templates.map((t) => (
            <li key={t.key}>
              <button
                onClick={() => {
                  setSelectedKey(t.key);
                  setDraft({ name: t.name, subject: t.subject, bodyHtml: t.bodyHtml });
                }}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                  selectedKey === t.key ? "bg-primary/10 text-foreground" : "hover:bg-accent"
                )}
              >
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{t.key}</span>
                </span>
                {t.isCustomised && (
                  <Badge variant="info" className="shrink-0 text-[10px]">
                    Edited
                  </Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {/* Editor */}
      {!selected || !draft ? (
        <Card className="flex items-center justify-center p-12">
          <p className="text-sm text-muted-foreground">
            Select a template on the left to edit it.
          </p>
        </Card>
      ) : (
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">{selected.name}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{selected.description}</p>
            </div>
            {selected.isCustomised && (
              <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)}>
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Reset to default
              </Button>
            )}
          </div>

          <div>
            <p className="text-sm font-medium">Available placeholders</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {selected.variables.map((v) => (
                <code
                  key={v}
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                >
                  {`{{${v}}}`}
                </code>
              ))}
            </div>
          </div>

          <FormField label="Template name" htmlFor="tpl-name" required>
            <Input
              id="tpl-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </FormField>

          <FormField label="Subject line" htmlFor="tpl-subject" required>
            <Input
              id="tpl-subject"
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
            />
          </FormField>

          <FormField
            label="HTML body"
            htmlFor="tpl-body"
            required
            hint="Placeholders are replaced server-side before sending."
          >
            <Textarea
              id="tpl-body"
              rows={16}
              className="font-mono text-xs"
              value={draft.bodyHtml}
              onChange={(e) => setDraft({ ...draft, bodyHtml: e.target.value })}
            />
          </FormField>

          <div>
            <p className="mb-1.5 text-sm font-medium">Preview</p>
            <div
              className="max-h-80 overflow-y-auto rounded-lg border bg-white p-4"
              // Admin-authored template markup, shown back to that same admin.
              dangerouslySetInnerHTML={{ __html: draft.bodyHtml }}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setDraft({
                  name: selected.name,
                  subject: selected.subject,
                  bodyHtml: selected.bodyHtml,
                })
              }
            >
              Discard changes
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              <Save className="mr-1.5 h-4 w-4" />
              {save.isPending ? "Saving…" : "Save template"}
            </Button>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset this template?"
        description="Your customised version will be deleted and the built-in default restored. This cannot be undone."
        confirmLabel="Reset to default"
        variant="destructive"
        onConfirm={() => reset.mutate()}
      />
    </div>
  );
}
