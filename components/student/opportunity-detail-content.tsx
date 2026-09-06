/**
 * Opportunity Detail Content Component — Phase 3
 * Main component handling opportunity display and application flow
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { OpportunityHeader } from "./opportunity-header";
import { OpportunityInfo } from "./opportunity-info";
import { JobRolesList } from "./job-roles-list";
import { ApplicationFlow } from "./application-flow";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, AlertCircle } from "lucide-react";

interface OpportunityData {
  id: string;
  title: string;
  description: string;
  company: {
    id: string;
    name: string;
    logoUrl: string | null;
    industry: string;
    website: string | null;
    description: string | null;
  };
  workMode: string;
  locations: string[];
  applicationOpenAt: string | null;
  applicationCloseAt: string | null;
  driveStartDate: string | null;
  driveEndDate: string | null;
  timeStatus: "active" | "closing_soon" | "closed";
  timeRemaining: number | null;
  jobRoles: Array<{
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
  }>;
  contactInfo: {
    name: string | null;
    email: string | null;
    phone: string | null;
    designation: string | null;
  };
  _count: {
    applications: number;
  };
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

interface OpportunityDetailResponse {
  opportunity: OpportunityData;
  eligibility: Record<string, EligibilityResult>;
  applicationStatus: Record<string, ApplicationStatus>;
}

export function OpportunityDetailContent({ opportunityId }: { opportunityId: string }) {
  const [data, setData] = useState<OpportunityDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApplicationFlow, setShowApplicationFlow] = useState(false);
  const [selectedJobRoleId, setSelectedJobRoleId] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const fetchOpportunityDetails = async () => {
    try {
      const response = await fetch(
        `/api/student/opportunities/${opportunityId}?checkEligibility=true`
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: "Opportunity Not Found",
            description: "The opportunity you're looking for doesn't exist or has been removed.",
            variant: "destructive",
          });
          router.push("/student/opportunities");
          return;
        }
        throw new Error(await response.text());
      }

      const result: OpportunityDetailResponse = await response.json();
      setData(result);
    } catch (error) {
      console.error("Failed to fetch opportunity details:", error);
      toast({
        title: "Error",
        description: "Failed to load opportunity details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunityDetails();
  }, [opportunityId]);

  // Auto-refresh to keep countdown timers accurate
  useEffect(() => {
    const interval = setInterval(() => {
      if (data?.opportunity.timeStatus !== "closed") {
        fetchOpportunityDetails();
      }
    }, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, [data?.opportunity.timeStatus]);

  const handleApplyClick = (jobRoleId: string) => {
    setSelectedJobRoleId(jobRoleId);
    setShowApplicationFlow(true);
  };

  const handleApplicationSuccess = () => {
    setShowApplicationFlow(false);
    setSelectedJobRoleId(null);
    toast({
      title: "Application Submitted",
      description: "Your application has been successfully submitted!",
      variant: "success",
    });
    // Refresh data to update application status
    fetchOpportunityDetails();
  };

  const handleApplicationCancel = () => {
    setShowApplicationFlow(false);
    setSelectedJobRoleId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Opportunity Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The opportunity you're looking for doesn't exist or has been removed.
        </p>
        <Button asChild>
          <Link href="/student/opportunities">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Opportunities
          </Link>
        </Button>
      </div>
    );
  }

  const { opportunity, eligibility, applicationStatus } = data;

  return (
    <>
      {/* Application Flow Modal/Overlay */}
      {showApplicationFlow && selectedJobRoleId && (
        <ApplicationFlow
          opportunityId={opportunityId}
          jobRoleId={selectedJobRoleId}
          eligibility={eligibility[selectedJobRoleId]}
          onSuccess={handleApplicationSuccess}
          onCancel={handleApplicationCancel}
        />
      )}

      {/* Main Content */}
      <div className="space-y-6">
        {/* Back Button */}
        <div>
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/student/opportunities">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Opportunities
            </Link>
          </Button>
        </div>

        {/* Opportunity Header */}
        <OpportunityHeader opportunity={opportunity} />

        {/* Alert for closing soon */}
        {opportunity.timeStatus === "closing_soon" && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-amber-600" />
                <div>
                  <h3 className="font-semibold text-amber-800">Applications Closing Soon</h3>
                  <p className="text-sm text-amber-700">
                    {opportunity.timeRemaining
                      ? `Only ${opportunity.timeRemaining} ${opportunity.timeRemaining === 1 ? 'hour' : 'hours'} left to apply!`
                      : "Applications will close soon!"
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alert for closed */}
        {opportunity.timeStatus === "closed" && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <div>
                  <h3 className="font-semibold text-red-800">Applications Closed</h3>
                  <p className="text-sm text-red-700">
                    This opportunity is no longer accepting applications.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Opportunity Information */}
            <OpportunityInfo opportunity={opportunity} />

            {/* Job Roles */}
            <JobRolesList
              jobRoles={opportunity.jobRoles}
              eligibility={eligibility}
              applicationStatus={applicationStatus}
              timeStatus={opportunity.timeStatus}
              onApplyClick={handleApplyClick}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Applications</p>
                  <p className="text-2xl font-bold">{opportunity._count.applications}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Available Roles</p>
                  <p className="text-2xl font-bold">
                    {opportunity.jobRoles.filter(r => r.isActive).length}
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Work Mode</p>
                  <Badge variant="secondary" className="mt-1">
                    {opportunity.workMode.replace("_", " ").toLowerCase()}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            {(opportunity.contactInfo.name || opportunity.contactInfo.email) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Point of Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {opportunity.contactInfo.name && (
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{opportunity.contactInfo.name}</p>
                      {opportunity.contactInfo.designation && (
                        <p className="text-sm text-muted-foreground">
                          {opportunity.contactInfo.designation}
                        </p>
                      )}
                    </div>
                  )}
                  {opportunity.contactInfo.email && (
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <a
                        href={`mailto:${opportunity.contactInfo.email}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {opportunity.contactInfo.email}
                      </a>
                    </div>
                  )}
                  {opportunity.contactInfo.phone && (
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="text-sm">{opportunity.contactInfo.phone}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}