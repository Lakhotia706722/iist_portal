"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { JourneyTracker, buildJourneySteps } from "./journey-tracker";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, DollarSign, Briefcase, ExternalLink,
  CheckCircle, XCircle, Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── types ────────────────────────────────────────────── */
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
    participant?: {
      status: string; result: string | null;
      feedback: string | null; attendanceStatus: string | null;
    };
  }>;
}

/* ── status helpers ───────────────────────────────────── */
const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  PENDING:     { label: "Pending",     icon: Clock,         cls: "bg-amber-50  text-amber-700  border-amber-200"  },
  SHORTLISTED: { label: "Shortlisted", icon: CheckCircle,   cls: "bg-green-50  text-green-700  border-green-200"  },
  REJECTED:    { label: "Not Selected",icon: XCircle,       cls: "bg-red-50    text-red-700    border-red-200"    },
  WITHDRAWN:   { label: "Withdrawn",   icon: XCircle,       cls: "bg-gray-50   text-gray-600   border-gray-200"   },
  OFFER_MADE:  { label: "Offer Made",  icon: CheckCircle,   cls: "bg-violet-50 text-violet-700 border-violet-200" },
  ACCEPTED:    { label: "Accepted",    icon: CheckCircle,   cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

function formatCtc(min: number | null, max: number | null) {
  if (!min && !max) return "Not disclosed";
  const lpa = (n: number) => `₹${(n / 100000).toFixed(1)} LPA`;
  if (!max) return `${lpa(min!)}+`;
  if (!min || min === max) return lpa(max);
  return `${lpa(min)}–${lpa(max)}`;
}

/* ── summary pill ─────────────────────────────────────── */
function SummaryPill({ applications }: { applications: Application[] }) {
  const counts = {
    total:       applications.length,
    active:      applications.filter(a => a.status === "PENDING").length,
    shortlisted: applications.filter(a => a.status === "SHORTLISTED").length,
    offers:      applications.filter(a => a.status === "OFFER_MADE" || a.status === "ACCEPTED").length,
  };
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        { label: "Drives Applied",  value: counts.total,       color: "text-blue-600" },
        { label: "In Progress",     value: counts.active,      color: "text-amber-600" },
        { label: "Shortlisted",     value: counts.shortlisted, color: "text-green-600" },
        { label: "Offers Received", value: counts.offers,      color: "text-violet-600" },
      ].map(s => (
        <Card key={s.label}>
          <CardContent className="p-4 text-center">
            <p className={cn("text-3xl font-bold", s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── main component ───────────────────────────────────── */
export function JourneyPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/student/applications?limit=50");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setApplications(data.applications ?? []);
    } catch {
      // Phase 11: same fetch-failure-looks-like-empty-list bug found on
      // admin/companies, admin/drives, and student/opportunities — this
      // page's "No applications yet" empty state used to render
      // identically whether the student genuinely had zero applications
      // or the fetch had just failed.
      setError(true);
      toast({ title: "Error", description: "Failed to load journey data.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;

  if (error) return <ErrorState onRetry={fetchApplications} />;

  if (applications.length === 0) {
    return (
      <EmptyState
        icon="briefcase"
        title="No applications yet"
        description="Once you apply to placement drives your journey will appear here."
        action={
          <Button asChild>
            <Link href="/student/opportunities"><Briefcase className="h-4 w-4 mr-2" />Browse Opportunities</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <SummaryPill applications={applications} />

      {/* Timeline cards — one per drive */}
      {applications.map(app => {
        const cfg = STATUS_CONFIG[app.status] ?? { label: app.status, icon: Clock, cls: "" };
        const StatusIcon = cfg.icon;
        const isOpen = expanded.has(app.id);
        const steps = buildJourneySteps(app);

        return (
          <Card key={app.id} className="overflow-hidden">
            {/* Card header */}
            <CardHeader
              className="cursor-pointer select-none pb-3 hover:bg-muted/30 transition-colors"
              onClick={() => toggle(app.id)}
            >
              <div className="flex items-start gap-4">
                {/* Logo */}
                {app.jobRole.drive.company.logoUrl ? (
                  <div className="relative h-12 w-12 shrink-0 rounded-lg border bg-white overflow-hidden">
                    {/* unoptimized: see ARCHITECTURE.md §13 — company.logoUrl's declared
                        MIME type isn't server-verified against actual bytes. */}
                    <Image src={app.jobRole.drive.company.logoUrl}
                      alt={app.jobRole.drive.company.name} fill className="object-contain p-1" unoptimized />
                  </div>
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded-lg border bg-muted flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="text-base leading-snug">
                        {app.jobRole.title}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {app.jobRole.drive.company.name} · {app.jobRole.drive.title}
                      </p>
                    </div>
                    <Badge variant="secondary" className={cn("shrink-0 gap-1 text-xs", cfg.cls)}>
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {formatCtc(app.jobRole.ctcMin, app.jobRole.ctcMax)}
                    </span>
                    <span>
                      Applied {new Date(app.appliedAt).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </span>
                    <span className="text-blue-600">
                      {isOpen ? "▲ Hide timeline" : "▼ Show timeline"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Admin note */}
              {app.adminNote && (
                <div className="mt-3 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
                  <span className="font-medium">Admin note: </span>{app.adminNote}
                </div>
              )}
            </CardHeader>

            {/* Expanded journey timeline */}
            {isOpen && (
              <CardContent className="border-t pt-5">
                <JourneyTracker steps={steps} />
                <div className="mt-4 flex justify-end">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/student/opportunities/${app.jobRole.drive.id}`}>
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      View Drive
                    </Link>
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
