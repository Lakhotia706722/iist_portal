/**
 * Drive Overview Component — Phase 3
 * 
 * Overview tab showing drive details and timeline.
 */

"use client";

import { Calendar, Clock, MapPin, Phone, Mail, User, FileText, Award, AlertTriangle, Check, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
 * Everything updateDriveStatus() (drive.service.ts) actually checks before
 * allowing PUBLISHED or APPLICATIONS_OPEN — kept in sync with that
 * function and with the same two checks mirrored in the drives list
 * page's disabled-menu-item tooltip, so there's exactly one place per
 * layer that has to agree with the real gate, not three copies drifting
 * apart.
 */
function publishConditions(drive: DriveOverviewProps["drive"]): { label: string; met: boolean }[] {
  return [
    { label: "Add at least one active job role", met: drive._count.jobRoles > 0 },
    { label: "Company is active", met: drive.company.isActive },
  ];
}

/**
 * Phase 18 P2 — root cause of a real "published drive, nothing shows to
 * students" report: reaching APPLICATIONS_OPEN with zero job roles, or
 * with an applicationOpenAt still in the future, is correct, intentional
 * behavior (a scheduled drive, or one an admin hasn't finished setting
 * up) — but until now there was no way for an admin looking at this page
 * to know *why* students see nothing. Below "Applications Open": a
 * checklist of what's actually blocking Publish (each condition mirrors
 * publishConditions() above, live — no refresh needed once satisfied, the
 * same props update that flips _count.jobRoles re-renders this). At or
 * past "Applications Open": a single most-relevant sentence, since the
 * checklist no longer applies.
 */
function visibilityBanner(drive: DriveOverviewProps["drive"]): string | null {
  if (drive.status !== "APPLICATIONS_OPEN") return null;
  if (drive._count.jobRoles === 0) {
    return "This drive has no job roles yet — even though applications are open, there's nothing for a student to see or apply to. Add a job role.";
  }
  if (drive.applicationOpenAt && new Date(drive.applicationOpenAt) > new Date()) {
    const opens = new Date(drive.applicationOpenAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    return `This drive becomes visible to students on ${opens}.`;
  }
  return null;
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

  const banner = visibilityBanner(drive);
  const isPrePublish = drive.status === "DRAFT" || drive.status === "PUBLISHED";
  const conditions = isPrePublish ? publishConditions(drive) : [];
  const unmetCount = conditions.filter((c) => !c.met).length;

  return (
    <div className="space-y-6">
      {isPrePublish && (
        <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="font-medium">
              {drive.status === "DRAFT"
                ? "This drive is still a draft — students can't see it."
                : "This drive is published but not yet open for applications — students won't see it yet."}
              {unmetCount > 0 ? " Before publishing:" : " Ready to move to Applications Open."}
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
      {banner && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{banner}</span>
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