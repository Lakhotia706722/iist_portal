"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect as Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/utils";
import { ShieldCheck, Layers, RotateCcw, X } from "lucide-react";

type PolicyRuleView = {
  key: string;
  label: string;
  description: string;
  type: "NUMBER" | "BOOLEAN" | "STRING";
  category: string;
  unit?: string;
  effectiveValue: number | boolean | string;
  global: { id: string; value: string; updatedAt: string; updatedById: string | null } | null;
  batchOverrides: Array<{ id: string; batchId: string; batchName: string; value: string; updatedAt: string }>;
  isDefault: boolean;
};

function displayValue(rule: PolicyRuleView, raw: string) {
  if (rule.type === "BOOLEAN") return raw === "true" ? "Enabled" : "Disabled";
  if (rule.unit) return `${raw}${rule.unit === "%" ? "%" : ` ${rule.unit}`}`;
  return raw;
}

export function PolicyClient() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<PolicyRuleView | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [scopeMode, setScopeMode] = useState<"global" | "batch">("global");
  const [scopeBatchId, setScopeBatchId] = useState("");
  const [removeTarget, setRemoveTarget] = useState<{ key: string; batchId: string | null; label: string } | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-policy"],
    queryFn: async () => {
      const res = await fetch("/api/admin/policy");
      if (!res.ok) throw new Error("Failed to load policy rules");
      return res.json() as Promise<{ rules: PolicyRuleView[] }>;
    },
  });

  const batchesQuery = useQuery({
    queryKey: ["batches"],
    queryFn: async () => {
      const res = await fetch("/api/admin/batches");
      if (!res.ok) return { batches: [] };
      const body = await res.json();
      return { batches: body.batches ?? body.items ?? [] };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/policy/${editing!.key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: draftValue,
          batchId: scopeMode === "batch" ? scopeBatchId : null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save policy value");
      return body;
    },
    onSuccess: () => {
      toast({ title: "Policy updated", variant: "success" });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-policy"] });
    },
    onError: (e: Error) =>
      toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const qs = removeTarget!.batchId ? `?batchId=${removeTarget!.batchId}` : "";
      const res = await fetch(`/api/admin/policy/${removeTarget!.key}${qs}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not remove override");
      return body;
    },
    onSuccess: () => {
      toast({ title: "Reverted to default", variant: "success" });
      setRemoveTarget(null);
      qc.invalidateQueries({ queryKey: ["admin-policy"] });
    },
    onError: (e: Error) =>
      toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const grouped = useMemo(() => {
    const rules = data?.rules ?? [];
    const byCategory = new Map<string, PolicyRuleView[]>();
    for (const r of rules) {
      const list = byCategory.get(r.category) ?? [];
      list.push(r);
      byCategory.set(r.category, list);
    }
    return [...byCategory.entries()];
  }, [data]);

  if (isLoading) return <LoadingState text="Loading policy rules…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const batches = batchesQuery.data?.batches ?? [];

  return (
    <div className="space-y-6">
      {grouped.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No policy keys registered" description="" />
      ) : (
        grouped.map(([category, rules]) => (
          <Card key={category} className="p-5">
            <h2 className="text-base font-semibold">{category}</h2>
            <div className="mt-4 divide-y">
              {rules.map((rule) => (
                <div key={rule.key} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{rule.label}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{rule.description}</p>
                      <code className="mt-1 inline-block text-[11px] text-muted-foreground/70">
                        {rule.key}
                      </code>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <p className="text-lg font-semibold tabular-nums">
                          {displayValue(rule, String(rule.effectiveValue))}
                        </p>
                        {rule.isDefault ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Default
                          </Badge>
                        ) : (
                          <Badge variant="info" className="text-[10px]">
                            Configured
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditing(rule);
                          setDraftValue(rule.global?.value ?? rule.effectiveValue.toString());
                          setScopeMode("global");
                          setScopeBatchId("");
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>

                  {rule.batchOverrides.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {rule.batchOverrides.map((o) => (
                        <span
                          key={o.id}
                          className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-2.5 py-1 text-xs"
                        >
                          <Layers className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{o.batchName}</span>
                          <span className="text-muted-foreground">
                            {displayValue(rule, o.value)}
                          </span>
                          <button
                            aria-label={`Remove override for ${o.batchName}`}
                            onClick={() =>
                              setRemoveTarget({ key: rule.key, batchId: o.batchId, label: `${rule.label} — ${o.batchName}` })
                            }
                            className="ml-1 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.label}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{editing.description}</p>

              <FormField label="Scope" htmlFor="policy-scope">
                <Select
                  id="policy-scope"
                  value={scopeMode}
                  onChange={(e) => {
                    setScopeMode(e.target.value as "global" | "batch");
                    if (e.target.value === "global") {
                      setDraftValue(editing.global?.value ?? editing.effectiveValue.toString());
                    }
                  }}
                >
                  <option value="global">Institute-wide default</option>
                  <option value="batch">Specific batch override</option>
                </Select>
              </FormField>

              {scopeMode === "batch" && (
                <FormField label="Batch" htmlFor="policy-batch" required>
                  <Select
                    id="policy-batch"
                    value={scopeBatchId}
                    onChange={(e) => {
                      setScopeBatchId(e.target.value);
                      const existing = editing.batchOverrides.find((o) => o.batchId === e.target.value);
                      setDraftValue(existing?.value ?? editing.effectiveValue.toString());
                    }}
                  >
                    <option value="">Choose a batch…</option>
                    {batches.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.academicYear})
                      </option>
                    ))}
                  </Select>
                </FormField>
              )}

              {editing.type === "BOOLEAN" ? (
                <FormField label="Value" htmlFor="policy-value">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="policy-value"
                      checked={draftValue === "true"}
                      onCheckedChange={(checked) => setDraftValue(checked ? "true" : "false")}
                    />
                    <span className="text-sm">{draftValue === "true" ? "Enabled" : "Disabled"}</span>
                  </div>
                </FormField>
              ) : editing.type === "NUMBER" ? (
                <FormField label={`Value${editing.unit ? ` (${editing.unit})` : ""}`} htmlFor="policy-value">
                  <Input
                    id="policy-value"
                    type="number"
                    step="any"
                    value={draftValue}
                    onChange={(e) => setDraftValue(e.target.value)}
                  />
                </FormField>
              ) : (
                <FormField
                  label="Value"
                  htmlFor="policy-value"
                  hint={editing.key === "already_placed_statuses" ? "Comma-separated ApplicationStatus values" : undefined}
                >
                  <Input
                    id="policy-value"
                    value={draftValue}
                    onChange={(e) => setDraftValue(e.target.value)}
                  />
                </FormField>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={
                !draftValue ||
                (scopeMode === "batch" && !scopeBatchId) ||
                save.isPending
              }
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title="Revert this override?"
        description={`"${removeTarget?.label}" will revert to the next-broadest scope (institute default or the coded default). This is audit-logged.`}
        confirmLabel="Revert"
        variant="destructive"
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
      />
    </div>
  );
}
