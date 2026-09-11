/**
 * Job Roles List Component — Phase 3
 * Displays available job roles with eligibility status and apply buttons
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Briefcase, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface JobRole {
  id: string;
  title: string;
  description: string;
  ctcMin: number | null;
  ctcMax: number | null;
  isActive: boolean;
  eligibilityRules: Array<{
    id: string;
    field: string;
    operator: string;
    value: string;
    label: string;
  }>;
}

interface EligibilityResult {
  eligible: boolean;
  results: Array<{
    ruleId: string;
    label: string;
    field: string;
    passed: boolean;
    reason: string;
  }>;
}

interface ApplicationStatus {
  applicationId?: string;
  status?: string;
  appliedAt?: string;
}

interface JobRolesListProps {
  jobRoles: JobRole[];
  eligibility: Record<string, EligibilityResult>;
  applicationStatus: Record<string, ApplicationStatus>;
  timeStatus: "active" | "closing_soon" | "closed";
  onApplyClick: (jobRoleId: string) => void;
}

export function JobRolesList({
  jobRoles,
  eligibility,
  applicationStatus,
  timeStatus,
  onApplyClick,
}: JobRolesListProps) {
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());

  const formatCtc = (min: number | null, max: number | null) => {
    if (!min && !max) return "Not disclosed";
    if (min === max) return `₹${(min || 0) / 100000} LPA`;
    if (!min) return `Up to ₹${max! / 100000} LPA`;
    if (!max) return `₹${min / 100000}+ LPA`;
    return `₹${min / 100000} - ${max / 100000} LPA`;
  };

  const getApplicationStatusBadge = (status: ApplicationStatus) => {
    if (!status.status) return null;

    const statusConfig = {
      PENDING: { label: "Applied", variant: "secondary" as const, color: "bg-blue-50 text-blue-700" },
      SHORTLISTED: { label: "Shortlisted", variant: "secondary" as const, color: "bg-green-50 text-green-700" },
      REJECTED: { label: "Not Selected", variant: "secondary" as const, color: "bg-red-50 text-red-700" },
      WITHDRAWN: { label: "Withdrawn", variant: "secondary" as const, color: "bg-gray-50 text-gray-700" },
    };

    const config = statusConfig[status.status as keyof typeof statusConfig];
    if (!config) return null;

    return (
      <Badge variant={config.variant} className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const getEligibilityStatus = (jobRoleId: string) => {
    const result = eligibility[jobRoleId];
    if (!result) return { status: "unknown", icon: AlertTriangle, color: "text-gray-500" };

    if (result.eligible) {
      return { status: "eligible", icon: CheckCircle, color: "text-green-600" };
    } else {
      return { status: "ineligible", icon: XCircle, color: "text-red-600" };
    }
  };

  const toggleRoleExpanded = (jobRoleId: string) => {
    const newExpanded = new Set(expandedRoles);
    if (newExpanded.has(jobRoleId)) {
      newExpanded.delete(jobRoleId);
    } else {
      newExpanded.add(jobRoleId);
    }
    setExpandedRoles(newExpanded);
  };

  const canApply = (jobRole: JobRole) => {
    return (
      jobRole.isActive &&
      timeStatus !== "closed" &&
      !applicationStatus[jobRole.id]?.status &&
      eligibility[jobRole.id]?.eligible
    );
  };

  const activeJobRoles = jobRoles.filter(role => role.isActive);

  if (activeJobRoles.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Active Job Roles</h3>
          <p className="text-muted-foreground">
            There are currently no active job roles for this opportunity.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Available Job Roles ({activeJobRoles.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeJobRoles.map((jobRole, index) => {
          const eligibilityStatus = getEligibilityStatus(jobRole.id);
          const applicationStatusBadge = getApplicationStatusBadge(applicationStatus[jobRole.id] || {});
          const isExpanded = expandedRoles.has(jobRole.id);
          const eligibilityResult = eligibility[jobRole.id];

          return (
            <div key={jobRole.id} className="space-y-3">
              {index > 0 && <Separator />}
              
              {/* Job Role Header */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg">{jobRole.title}</h3>
                    
                    {/* CTC */}
                    <div className="flex items-center gap-2 mt-1 mb-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-muted-foreground">
                        {formatCtc(jobRole.ctcMin, jobRole.ctcMax)}
                      </span>
                    </div>

                    {/* Status Badges */}
                    <div className="flex items-center gap-2 mb-2">
                      {/* Eligibility Status */}
                      <div className="flex items-center gap-1">
                        <eligibilityStatus.icon className={cn("h-4 w-4", eligibilityStatus.color)} />
                        <span className={cn("text-sm font-medium", eligibilityStatus.color)}>
                          {eligibilityStatus.status === "eligible" ? "Eligible" :
                           eligibilityStatus.status === "ineligible" ? "Not Eligible" : "Check Eligibility"}
                        </span>
                      </div>

                      {/* Application Status */}
                      {applicationStatusBadge}
                    </div>

                    {/* Description Preview */}
                    {jobRole.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {jobRole.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {/* Apply Button */}
                    {!applicationStatus[jobRole.id]?.status ? (
                      <Button
                        onClick={() => onApplyClick(jobRole.id)}
                        disabled={!canApply(jobRole)}
                        size="sm"
                        className={timeStatus === "closing_soon" ? "bg-orange-600 hover:bg-orange-700" : ""}
                      >
                        {timeStatus === "closed" ? "Applications Closed" :
                         !eligibilityResult?.eligible ? "Not Eligible" :
                         timeStatus === "closing_soon" ? "Apply Now!" : "Apply"}
                      </Button>
                    ) : (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          Applied on {new Date(applicationStatus[jobRole.id].appliedAt!).toLocaleDateString()}
                        </p>
                      </div>
                    )}

                    {/* Expand/Collapse Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRoleExpanded(jobRole.id)}
                      className="h-8 w-8 p-0"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="space-y-4 pt-3 border-t">
                    {/* Full Description */}
                    {jobRole.description && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Job Description</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-line">
                          {jobRole.description}
                        </p>
                      </div>
                    )}

                    {/* Eligibility Requirements */}
                    {eligibilityResult && (
                      <div>
                        <h4 className="font-medium text-sm mb-3">Eligibility Requirements</h4>
                        <div className="space-y-2">
                          {eligibilityResult.results.map((result) => (
                            <div
                              key={result.ruleId}
                              className="flex items-start gap-2 p-2 rounded-lg border"
                            >
                              {result.passed ? (
                                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{result.label}</p>
                                <p className="text-xs text-muted-foreground">{result.reason}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}