"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect as Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ComplianceBadge } from "@/components/shared/compliance-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/utils";
import { ShieldCheck, ShieldAlert, PenLine } from "lucide-react";
import { COMPLIANCE_STATUSES } from "@/lib/validations/compliance";

type ComplianceResult = {
  status: string;
  reasons: string[];
  isOverridden: boolean;
  override: { status: string; reason: string; setById: string; createdAt: string } | null;
  signals: {
    isDebarred: boolean;
    debarReason: string | null;
    hasActivePlacement: boolean;
    openIncidents: Array<{ id: string; severity: string; violationType: string }>;
    attendancePercentage: number | null;
    documentsVerified: boolean;
    skillUpAverage: number | null;
    skillUpRequired: boolean;
    minSkillUpScore: number;
    minAttendancePercentage: number;
    documentVerificationRequired: boolean;
  };
};

/**
 * `endpoint`: where to fetch the status from.
 * `adminControls`: when true (staff viewing another student), shows the
 * override/clear controls; the student's own view is always read-only.
 */
export function ComplianceView({
  endpoint,
  studentId,
  adminControls = false,
}: {
  endpoint: string;
  studentId?: string;
  adminControls?: boolean;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState("CONDITIONAL");
  const [overrideReason, setOverrideReason] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  // Live — Phase 15: derived from application/attendance/document data that
  // admin staff (or the compliance engine reacting to their actions)
  // changes; shared by both the student's own compliance page and the
  // admin/HOD compliance-detail view.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["compliance", endpoint],
    queryFn: async () => {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Failed to load compliance status");
      return res.json() as Promise<ComplianceResult>;
    },
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  const setOverride = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/compliance/${studentId}/override`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: overrideStatus, reason: overrideReason }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not set override");
      return body;
    },
    onSuccess: () => {
      toast({ title: "Compliance status overridden", variant: "success" });
      setOverrideOpen(false);
      setOverrideReason("");
      qc.invalidateQueries({ queryKey: ["compliance", endpoint] });
    },
    onError: (e: Error) =>
      toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const clearOverride = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/compliance/${studentId}/override`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not clear override");
      return body;
    },
    onSuccess: () => {
      toast({ title: "Override cleared — status reverts to computed", variant: "success" });
      setConfirmClear(false);
      qc.invalidateQueries({ queryKey: ["compliance", endpoint] });
    },
    onError: (e: Error) =>
      toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <LoadingState text="Loading compliance status…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const result = data!;
  const s = result.signals;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Compliance status</p>
            <div className="mt-1">
              <ComplianceBadge status={result.status} isOverridden={result.isOverridden} className="text-sm" />
            </div>
          </div>
          {adminControls && studentId && (
            <div className="flex gap-2">
              {result.isOverridden && (
                <Button variant="outline" size="sm" onClick={() => setConfirmClear(true)}>
                  Clear override
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOverrideStatus(result.status);
                  setOverrideReason("");
                  setOverrideOpen(true);
                }}
              >
                <PenLine className="mr-1.5 h-4 w-4" />
                Override
              </Button>
            </div>
          )}
        </div>

        {result.isOverridden && result.override && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-medium text-amber-900">Manually overridden</p>
              <p className="mt-0.5 text-amber-800">{result.override.reason}</p>
              <p className="mt-1 text-xs text-amber-700">
                Set {formatDateTime(result.override.createdAt)}
              </p>
            </div>
          </div>
        )}

        <div className="mt-4">
          <p className="text-sm font-medium">
            {result.isOverridden ? "Reason for override" : "Why this status"}
          </p>
          <ul className="mt-1.5 space-y-1">
            {result.reasons.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold">Underlying signals</h3>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Signal label="Open incidents" value={s.openIncidents.length} />
          <Signal
            label="Placement-round attendance"
            value={s.attendancePercentage != null ? `${s.attendancePercentage}%` : "No rounds yet"}
            hint={s.minAttendancePercentage > 0 ? `Required: ${s.minAttendancePercentage}%` : undefined}
          />
          <Signal
            label="Documents"
            value={s.documentsVerified ? "All verified" : "Not all verified"}
            hint={s.documentVerificationRequired ? "Verification required by policy" : undefined}
          />
          <Signal
            label="SkillUp average"
            value={s.skillUpAverage != null ? `${s.skillUpAverage}%` : "No results yet"}
            hint={s.minSkillUpScore > 0 ? `Required: ${s.minSkillUpScore}%` : undefined}
          />
          <Signal label="Active placement" value={s.hasActivePlacement ? "Yes" : "No"} />
          <Signal label="Debarred" value={s.isDebarred ? "Yes" : "No"} />
        </dl>
      </Card>

      {/* Override dialog */}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override compliance status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This replaces the computed status until cleared. A reason is required and this
              action is audit-logged.
            </p>
            <FormField label="New status" htmlFor="override-status" required>
              <Select
                id="override-status"
                value={overrideStatus}
                onChange={(e) => setOverrideStatus(e.target.value)}
              >
                {COMPLIANCE_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st.charAt(0) + st.slice(1).toLowerCase()}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Reason" htmlFor="override-reason" required hint="At least 10 characters">
              <Textarea
                id="override-reason"
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={overrideReason.trim().length < 10 || setOverride.isPending}
              onClick={() => setOverride.mutate()}
            >
              {setOverride.isPending ? "Saving…" : "Apply override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear this override?"
        description="The status will revert to the computed value based on policy and incident history. This is audit-logged."
        confirmLabel="Clear override"
        variant="destructive"
        onConfirm={() => clearOverride.mutate()}
        loading={clearOverride.isPending}
      />
    </div>
  );
}

function Signal({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-base font-medium">{value}</dd>
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  );
}
