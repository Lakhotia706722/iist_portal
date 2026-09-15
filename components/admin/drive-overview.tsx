/**
 * Drive Overview Component — Phase 3
 * 
 * Overview tab showing drive details and timeline.
 */

"use client";

import { Calendar, Clock, MapPin, Phone, Mail, User, FileText, Award, AlertTriangle, Check, X, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getApplicationWindowMessage } from "@/lib/drive-status";

interface DriveOverviewProps {
  drive: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    applicationOpenAt: string | null;
    applicationCloseAt: string | null;
    driveStartDate: string | null;
    driveEndDate: string | null;
    workMode: string;
    locations: string[];
    bond: string | null;
    selectionProcess: string | null;
    perksAndBenefits: string | null;
    pointOfContact: string | null;
    pocEmail: string | null;
    pocPhone: string | null;
    company: {
      name: string;
      industry: string;
      isActive: boolean;
    };
    _count: {
      /** Active job roles only. */
      jobRoles: number;
    };
  };
  onUpdate: () => void;
}

/**
 * Everything that gates DRAFT -> PUBLISHED in updateDriveStatus()
 * (drive.service.ts) — kept in sync with that function and with the same
 * checks mirrored in the drives list page's disabled-menu-item tooltip,
 * so there's exactly one place per layer that has to agree with the real
 * gate, not three copies drifting apart.
 */
function publishConditions(drive: DriveOverviewProps["drive"]): { label: string; met: boolean }[] {
  return [
    { label: "Add at least one active job role", met: drive._count.jobRoles > 0 },
    { label: "Company is active", met: drive.company.isActive },
  ];
}

/**
 * Phase 19 — once a drive is PUBLISHED, whether it's currently accepting
 * applications is derived from its dates (lib/drive-status.ts), never a
 * separate status an admin clicks into. So there's nothing left to
 * "unblock" here the way the pre-publish checklist above does — just an
 * accurate, purely informational read of where the drive actually is
 * right now. The one real remaining problem (Phase 18 P2's original
 * report): a published drive can still end up with zero active roles if
 * they're later deactivated, which stays a distinct warning rather than
 * folding into the informational message.
 */
function publishedStatusMessage(drive: DriveOverviewProps["drive"]): { text: string; isProblem: boolean } {
  if (drive._count.jobRoles === 0) {
    return {
      text: "This drive has no active job roles — even though it's published, there's nothing for a student to see or apply to. Add a job role.",
      isProblem: true,
    };
  }
  return { text: getApplicationWindowMessage(drive), isProblem: false };
}

const WORK_MODE_LABELS = {
  ONSITE: "On-site",
  REMOTE: "Remote", 
  HYBRID: "Hybrid",
};

export function DriveOverview({ drive, onUpdate }: DriveOverviewProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleString();
  };

  const formatDateShort = (dateString: string | null) => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleDateString();
  };

  const isDraft = drive.status === "DRAFT";
  const conditions = isDraft ? publishConditions(drive) : [];
  const unmetCount = conditions.filter((c) => !c.met).length;
  const publishedStatus = drive.status === "PUBLISHED" ? publishedStatusMessage(drive) : null;

  return (
    <div className="space-y-6">
      {isDraft && (
        <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="font-medium">
              This drive is still a draft — students can&apos;t see it.
              {unmetCount > 0 ? " Before publishing:" : " Ready to publish."}
            </span>
          </div>
          {unmetCount > 0 && (
            <ul className="mt-2 ml-6 space-y-1">
              {conditions.map((c) => (
                <li key={c.label} className="flex items-center gap-1.5">
                  {c.met ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />
                  ) : (
                    <X className="h-3.5 w-3.5 shrink-0 text-destructive" />
                  )}
                  <span className={c.met ? "text-muted-foreground line-through" : ""}>{c.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {publishedStatus && publishedStatus.isProblem && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{publishedStatus.text}</span>
        </div>
      )}
      {publishedStatus && !publishedStatus.isProblem && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{publishedStatus.text}</span>
        </div>
      )}

      {/* Drive Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Drive Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {drive.description && (
              <div>
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">{drive.description}</p>
              </div>
            )}
            
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Work Mode</span>
                <Badge variant="outline">
                  {WORK_MODE_LABELS[drive.workMode as keyof typeof WORK_MODE_LABELS]}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Industry</span>
                <span className="text-sm text-muted-foreground">{drive.company.industry}</span>
              </div>
              
              {drive.locations.length > 0 && (
                <div>
                  <span className="text-sm font-medium">Locations</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {drive.locations.map((location, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        <MapPin className="h-3 w-3 mr-1" />
                        {location}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Applications Open</span>
                <span className="text-sm text-muted-foreground">{formatDateShort(drive.applicationOpenAt)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Applications Close</span>
                <span className="text-sm text-muted-foreground">{formatDateShort(drive.applicationCloseAt)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Drive Starts</span>
                <span className="text-sm text-muted-foreground">{formatDateShort(drive.driveStartDate)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Drive Ends</span>
                <span className="text-sm text-muted-foreground">{formatDateShort(drive.driveEndDate)}</span>
              </div>
            </div>

            {/* Time remaining indicator */}
            {drive.applicationCloseAt && (
              <div className="pt-3 border-t">
                <div className="text-sm">
                  <span className="font-medium">Time Remaining: </span>
                  <span className="text-muted-foreground">
                    {(() => {
                      const now = new Date();
                      const closeDate = new Date(drive.applicationCloseAt);
                      const timeDiff = closeDate.getTime() - now.getTime();
                      
                      if (timeDiff <= 0) {
                        return "Applications closed";
                      }
                      
                      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                      const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                      
                      if (days > 0) {
                        return `${days} days, ${hours} hours`;
                      } else {
                        return `${hours} hours`;
                      }
                    })()}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Information */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Selection Process */}
        {drive.selectionProcess && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Selection Process
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {drive.selectionProcess}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Perks & Benefits */}
        {drive.perksAndBenefits && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Perks & Benefits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {drive.perksAndBenefits}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Bond Details */}
        {drive.bond && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Bond Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {drive.bond}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Point of Contact */}
        {(drive.pointOfContact || drive.pocEmail || drive.pocPhone) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Point of Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {drive.pointOfContact && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{drive.pointOfContact}</span>
                </div>
              )}
              
              {drive.pocEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a 
                    href={`mailto:${drive.pocEmail}`} 
                    className="text-sm text-primary hover:underline"
                  >
                    {drive.pocEmail}
                  </a>
                </div>
              )}
              
              {drive.pocPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a 
                    href={`tel:${drive.pocPhone}`} 
                    className="text-sm text-primary hover:underline"
                  >
                    {drive.pocPhone}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}