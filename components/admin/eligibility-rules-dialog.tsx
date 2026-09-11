/**
 * Eligibility Rules manager — Phase 13
 *
 * drive-job-roles.tsx has displayed eligibility rules since Phase 3, but
 * there was never any way to actually CREATE one — no "Add Rule" button,
 * no form, nothing. The backend (eligibilityRulesBulkSchema,
 * bulkUpdateEligibilityRules, /api/admin/drives/[id]/eligibility, and the
 * whole lib/eligibility-engine/index.ts matcher) has existed since Phase 3
 * and was fully wired into application-time checks — it just had no UI
 * surface an admin could reach. Found while proving the full
 * company→drive→role→eligibility→application chain end to end.
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect as Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ELIGIBILITY_FIELDS } from "@/lib/validations/placement";
import { Plus, X, ShieldCheck } from "lucide-react";

type Rule = { id: string; field: string; operator: string; value: string; label: string; isActive: boolean };

const FIELD_LABELS: Record<string, string> = {
  CGPA: "CGPA", ACTIVE_BACKLOGS: "Active backlogs", TOTAL_BACKLOGS: "Total backlogs",
  BATCH: "Batch (academic year)", BRANCH: "Branch (code, comma-separated)", COURSE: "Course (code, comma-separated)",
  GENDER: "Gender", CATEGORY: "Category", PLACEMENT_STATUS: "Placement status", PROFILE_STATUS: "Profile status",
  TENTH_PERCENTAGE: "10th %", TWELFTH_PERCENTAGE: "12th %", CURRENT_SEMESTER: "Current semester",
  SKILLUP_SCORE: "SkillUp average % (optionally \"slug:pct\")",
};

const OPERATOR_LABELS: Record<string, string> = {
  GTE: "≥ (at least)", LTE: "≤ (at most)", EQ: "= (equals)", IN: "is one of", NOT_IN: "is not one of",
};

// Phase 13 — lib/eligibility-engine/index.ts's listCheck() (used for every
// categorical field below) silently returns `false` for ANY operator it
// doesn't recognize (IN/NOT_IN/EQ only) — so a rule created with GTE/LTE
// against e.g. BRANCH doesn't error, it just rejects every student, always,
// with nothing visibly wrong anywhere. Found by an admin (in this phase's
// own end-to-end proof) picking the operator dropdown's first/default
// value for a Branch rule. Constraining which operators are even offered
// per field, instead of just documenting the trap, makes the mistake
// structurally impossible rather than relying on an admin reading a hint.
const CATEGORICAL_FIELDS = new Set(["BATCH", "BRANCH", "COURSE", "GENDER", "CATEGORY", "PLACEMENT_STATUS", "PROFILE_STATUS"]);
const CATEGORICAL_OPERATORS = ["IN", "NOT_IN", "EQ"] as const;
const NUMERIC_OPERATORS = ["GTE", "LTE", "EQ"] as const;
function operatorsFor(field: string): readonly string[] {
  return CATEGORICAL_FIELDS.has(field) ? CATEGORICAL_OPERATORS : NUMERIC_OPERATORS;
}

interface Props {
  driveId: string;
  jobRoleId: string;
  jobRoleTitle: string;
  rules: Rule[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EligibilityRulesDialog({ driveId, jobRoleId, jobRoleTitle, rules: initialRules, open, onOpenChange, onSaved }: Props) {
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const [field, setField] = useState<string>(ELIGIBILITY_FIELDS[0]);
  const [operator, setOperator] = useState<string>("GTE");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  function addRule() {
    if (!value.trim() || !label.trim()) {
      toast({ title: "Fill in both value and label", variant: "destructive" });
      return;
    }
    setRules((prev) => [...prev, { id: `new-${Date.now()}`, field, operator, value: value.trim(), label: label.trim(), isActive: true }]);
    setValue("");
    setLabel("");
  }

  function removeRule(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/drives/${driveId}/eligibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobRoleId,
          rules: rules.map((r) => ({ field: r.field, operator: r.operator, value: r.value, label: r.label, isActive: r.isActive })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to save eligibility rules");
      }
      toast({ title: "Eligibility rules saved", variant: "success" });
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Couldn't save rules", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Eligibility — {jobRoleTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rules yet — every student can apply. Add a rule below to restrict by branch, CGPA, etc.</p>
          ) : (
            <div className="space-y-2">
              {rules.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
                  <div>
                    <p className="font-medium">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{FIELD_LABELS[r.field] ?? r.field} {OPERATOR_LABELS[r.operator] ?? r.operator} {r.value}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeRule(r.id)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-medium text-muted-foreground">Add a rule</p>
            <div className="grid grid-cols-2 gap-2">
              <Select
                aria-label="Field"
                value={field}
                onChange={(e) => {
                  const nextField = e.target.value;
                  setField(nextField);
                  // Reset to a valid operator for the new field — see the
                  // comment above operatorsFor() for why this can't be left
                  // at whatever was previously selected.
                  const valid = operatorsFor(nextField);
                  if (!valid.includes(operator)) setOperator(valid[0]);
                }}
              >
                {ELIGIBILITY_FIELDS.map((f) => <option key={f} value={f}>{FIELD_LABELS[f] ?? f}</option>)}
              </Select>
              <Select aria-label="Operator" value={operator} onChange={(e) => setOperator(e.target.value)}>
                {operatorsFor(field).map((o) => <option key={o} value={o}>{OPERATOR_LABELS[o] ?? o}</option>)}
              </Select>
            </div>
            <Input placeholder="Value — e.g. 7.5 for CGPA, or BTECH-CSE for Branch" value={value} onChange={(e) => setValue(e.target.value)} />
            <Input placeholder="Label shown to students — e.g. Minimum CGPA 7.5" value={label} onChange={(e) => setLabel(e.target.value)} />
            <Button type="button" variant="outline" size="sm" onClick={addRule}><Plus className="h-3.5 w-3.5" /> Add rule</Button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save} loading={saving}>Save rules</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
