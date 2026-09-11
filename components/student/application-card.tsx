"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { JourneyTracker, buildJourneySteps } from "./journey-tracker";
import {
  Building2, DollarSign, FileText, ChevronDown, ChevronUp,
  ExternalLink, Trash2, Eye
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Application {
  id: string;
  status: string;
  appliedAt: string;
  updatedAt: string;
  adminNote: string | null;
  withdrawReason: string | null;
  jobRole: {
    id: string;
    title: string;
    ctcMin: number | null;
    ctcMax: number | null;
    drive: {
      id: string;
      title: string;
      status: string;
      applicationCloseAt: string | null;
      company: { name: string; logoUrl: string | null; industry: string };
    };
  };
  resumeVersion: { filename: string; fileUrl: string } | null;
  statusHistory: Array<{
    id: string; fromStatus: string | null; toStatus: string;
    changedAt: string; changedBy: string | null; reason: string | null;
  }>;
  rounds?: Array<{
    id: string; title: string; type: string; scheduledAt: string | null;
    participant?: { status: string; result: string | null; feedback: string | null; attendanceStatus: string | null };
  }>;
}

interface Props {
  application: Application;
  onWithdraw: (id: string, reason?: string) => void;
  onViewDetails: (app: Application) => void;
  refreshing?: boolean;
}

/** Softer, student-facing wording; colours come from StatusBadge. */
const STUDENT_STATUS_LABELS: Record<string, string> = {
  APPLIED: "Applied",
  UNDER_REVIEW: "Pending Review",
  REJECTED: "Not Selected",
  SELECTED: "Selected 🎉",
};

function formatCtc(min: number | null, max: number | null) {
  if (!min && !max) return "Not disclosed";
  const lpa = (n: number) => `₹${(n / 100000).toFixed(1)} LPA`;
  if (!max) return `${lpa(min!)}+`;
  if (!min || min === max) return lpa(max);
  return `${lpa(min)} – ${lpa(max)}`;
}

export function ApplicationCard({ application, onWithdraw, onViewDetails, refreshing }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const canWithdraw = application.status === "PENDING";
  const journeySteps = buildJourneySteps(application);

  const handleWithdraw = async () => {
    if (!confirm("Are you sure you want to withdraw this application?")) return;
    setWithdrawing(true);
    await onWithdraw(application.id);
    setWithdrawing(false);
  };

  return (
    <Card className={cn("transition-all", refreshing && "opacity-60")}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          {/* Company logo */}
          <div className="shrink-0">
            {application.jobRole.drive.company.logoUrl ? (
              <div className="relative h-12 w-12 rounded-lg border bg-white overflow-hidden">
                {/* unoptimized: company.logoUrl is an admin-uploaded file whose declared
                    MIME type isn't server-verified against actual bytes — skip Next's
                    server-side Image Optimization API for it (see ARCHITECTURE.md §13). */}
                <Image src={application.jobRole.drive.company.logoUrl}
                  alt={application.jobRole.drive.company.name} fill className="object-contain p-1" unoptimized />
              </div>
            ) : (
              <div className="h-12 w-12 rounded-lg border bg-muted flex items-center justify-center">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold leading-snug">{application.jobRole.title}</h3>
                <p className="text-sm text-muted-foreground">{application.jobRole.drive.company.name}</p>
                <p className="text-xs text-muted-foreground">{application.jobRole.drive.title}</p>
              </div>
              <StatusBadge
                status={application.status}
                label={STUDENT_STATUS_LABELS[application.status]}
                className="shrink-0 text-xs"
              />
            </div>

            <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" />
                {formatCtc(application.jobRole.ctcMin, application.jobRole.ctcMax)}
              </span>
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                Applied {new Date(application.appliedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Admin note */}
        {application.adminNote && (
          <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
            <span className="font-medium">Note from admin: </span>{application.adminNote}
          </div>
        )}

        {/* Expandable journey */}
        <div>
          <Button variant="ghost" size="sm" className="w-full justify-between h-8 px-2 text-xs text-muted-foreground"
            onClick={() => setExpanded(!expanded)}>
            {expanded ? "Hide journey" : `View journey (${journeySteps.length} steps)`}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>

          {expanded && (
            <div className="mt-3 pl-1">
              <JourneyTracker steps={journeySteps} compact />
            </div>
          )}
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/student/opportunities/${application.jobRole.drive.id}`}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              View Drive
            </Link>
          </Button>

          <div className="flex gap-2">
            {application.resumeVersion && (
              <Button variant="ghost" size="sm" asChild>
                <a href={application.resumeVersion.fileUrl} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Resume
                </a>
              </Button>
            )}
            {canWithdraw && (
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                onClick={handleWithdraw} disabled={withdrawing}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {withdrawing ? "Withdrawing…" : "Withdraw"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
