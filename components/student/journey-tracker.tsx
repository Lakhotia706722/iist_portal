"use client";

import { Badge } from "@/components/ui/badge";
import {
  CheckCircle, XCircle, Clock, Circle, User, CalendarDays, MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface JourneyStep {
  id: string;
  label: string;
  date: string | null;
  status: "passed" | "failed" | "pending" | "current" | "upcoming";
  result?: string | null;
  feedback?: string | null;
  remark?: string | null;
  type: "application" | "round" | "status_change";
}

interface JourneyTrackerProps {
  steps: JourneyStep[];
  compact?: boolean;
}

const statusIcon = {
  passed:   { Icon: CheckCircle, cls: "text-green-600 bg-green-50 border-green-200" },
  failed:   { Icon: XCircle,     cls: "text-red-600 bg-red-50 border-red-200" },
  current:  { Icon: Clock,       cls: "text-blue-600 bg-blue-50 border-blue-200" },
  pending:  { Icon: Clock,       cls: "text-amber-600 bg-amber-50 border-amber-200" },
  upcoming: { Icon: Circle,      cls: "text-muted-foreground bg-muted border-border" },
};

export function JourneyTracker({ steps, compact = false }: JourneyTrackerProps) {
  if (steps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">No journey data yet.</p>
    );
  }

  return (
    <ol className="relative space-y-0">
      {steps.map((step, idx) => {
        const { Icon, cls } = statusIcon[step.status];
        const isLast = idx === steps.length - 1;
        return (
          <li key={step.id} className="flex gap-4">
            {/* Timeline spine */}
            <div className="flex flex-col items-center">
              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2", cls)}>
                <Icon className="h-4 w-4" />
              </div>
              {!isLast && <div className="mt-1 w-0.5 flex-1 bg-border min-h-[1.5rem]" />}
            </div>

            {/* Content */}
            <div className={cn("pb-6 min-w-0 flex-1", isLast && "pb-0")}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("font-medium text-sm", step.status === "upcoming" && "text-muted-foreground")}>
                  {step.label}
                </span>
                {step.result && (
                  <Badge variant="secondary" className={cn("text-xs",
                    step.result === "PASSED" ? "bg-green-50 text-green-700" :
                    step.result === "FAILED" ? "bg-red-50 text-red-700" : "")}>
                    {step.result}
                  </Badge>
                )}
              </div>

              {step.date && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <CalendarDays className="h-3 w-3" />
                  {new Date(step.date).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              )}

              {!compact && (step.feedback || step.remark) && (
                <p className="flex items-start gap-1 text-xs text-muted-foreground mt-1 bg-muted/50 rounded px-2 py-1">
                  <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                  {step.feedback || step.remark}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Convert an Application record into JourneyStep[] */
export function buildJourneySteps(application: {
  status: string;
  appliedAt: string;
  statusHistory: Array<{
    id: string; fromStatus: string | null; toStatus: string;
    changedAt: string; reason: string | null;
  }>;
  rounds?: Array<{
    id: string; title: string; type: string; scheduledAt: string | null;
    participant?: { status: string; result: string | null; feedback: string | null; attendanceStatus: string | null };
  }>;
}): JourneyStep[] {
  const steps: JourneyStep[] = [];

  // 1 — Applied
  steps.push({
    id: "applied",
    label: "Application Submitted",
    date: application.appliedAt,
    status: "passed",
    type: "application",
  });

  // 2 — Status history events (skip the initial PENDING entry). Defensive
  // `?? []`: the API always sends this array now, but a component this
  // deep in the render tree should never crash the whole page on a
  // malformed response.
  for (const h of application.statusHistory ?? []) {
    if (h.toStatus === "PENDING") continue;
    steps.push({
      id: h.id,
      label: formatStatus(h.toStatus),
      date: h.changedAt,
      status: resolveHistoryStatus(h.toStatus),
      remark: h.reason,
      type: "status_change",
    });
  }

  // 3 — Rounds
  for (const round of application.rounds ?? []) {
    const p = round.participant;
    let rStatus: JourneyStep["status"] = "upcoming";
    if (p) {
      // Stored values are "PASS"/"FAIL"/"HOLD" (see RoundParticipant.result
      // in prisma/schema.prisma) — not "PASSED"/"FAILED".
      if (p.result === "PASS") rStatus = "passed";
      else if (p.result === "FAIL") rStatus = "failed";
      else if (p.status === "PRESENT" || p.status === "ABSENT") rStatus = "current";
      else rStatus = "pending";
    }
    steps.push({
      id: round.id,
      label: round.title,
      date: round.scheduledAt,
      status: rStatus,
      result: p?.result ?? null,
      feedback: p?.feedback ?? null,
      type: "round",
    });
  }

  return steps;
}

function formatStatus(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function resolveHistoryStatus(s: string): JourneyStep["status"] {
  if (["SHORTLISTED", "OFFER_MADE", "ACCEPTED"].includes(s)) return "passed";
  if (["REJECTED", "WITHDRAWN"].includes(s)) return "failed";
  return "current";
}
