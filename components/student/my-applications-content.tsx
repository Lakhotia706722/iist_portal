/**
 * My Applications Content Component — Phase 3
 * Handles data fetching and display of student applications
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApplicationCard } from "./application-card";
import { ApplicationsFilters } from "./applications-filters";
import { ApplicationsStats } from "./applications-stats";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { Search, Filter, RefreshCw, FileText } from "lucide-react";

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
      company: {
        name: string;
        logoUrl: string | null;
        industry: string;
      };
    };
  };
  resumeVersion: {
    filename: string;
    fileUrl: string;
  } | null;
  statusHistory: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    changedAt: string;
    changedBy: string | null;
    reason: string | null;
  }>;
  rounds?: Array<{
    id: string;
    title: string;
    type: string;
    scheduledAt: string | null;
    participant?: {
      status: string;
      result: string | null;
      feedback: string | null;
      attendanceStatus: string | null;
    };
  }>;
}

interface ApplicationsResponse {
  applications: Application[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export function MyApplicationsContent({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const [data, setData] = useState<ApplicationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();

  // Extract current filters from search params
  const currentFilters = useMemo(
    () => ({
      search: (searchParams.search as string) || "",
      status: (searchParams.status as string) || "",
      academicYear: (searchParams.academicYear as string) || "",
      limit: 20,
      offset: parseInt((searchParams.offset as string) || "0"),
    }),
    [searchParams]
  );

  const fetchApplications = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const queryParams = new URLSearchParams();
      if (currentFilters.search) queryParams.set("search", currentFilters.search);
      if (currentFilters.status) queryParams.set("status", currentFilters.status);
      if (currentFilters.academicYear) queryParams.set("academicYear", currentFilters.academicYear);
      queryParams.set("limit", currentFilters.limit.toString());
      queryParams.set("offset", currentFilters.offset.toString());

      const response = await fetch(`/api/student/applications?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result: ApplicationsResponse = await response.json();
      setData(result);

    } catch (error) {
      console.error("Failed to fetch applications:", error);
      toast({
        title: "Error",
        description: "Failed to load applications. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentFilters, toast]);

  // Update URL with new filters
  const updateFilters = (newFilters: Partial<typeof currentFilters>) => {
    const params = new URLSearchParams();
    
    const filters = { ...currentFilters, ...newFilters, offset: 0 }; // Reset offset on filter change
    
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.academicYear) params.set("academicYear", filters.academicYear);
    if (filters.offset > 0) params.set("offset", filters.offset.toString());

    const queryString = params.toString();
    router.push(`/student/applications${queryString ? `?${queryString}` : ""}`);
  };

  // Load more applications (pagination)
  const loadMore = () => {
    updateFilters({ offset: currentFilters.offset + currentFilters.limit });
  };

  // Withdraw application
  const handleWithdrawApplication = async (applicationId: string, reason?: string) => {
    try {
      const response = await fetch(`/api/student/applications/${applicationId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast({
        title: "Application Withdrawn",
        description: "Your application has been successfully withdrawn.",
        variant: "success",
      });

      // Refresh data
      fetchApplications(true);
    } catch (error) {
      console.error("Failed to withdraw application:", error);
      toast({
        title: "Error",
        description: "Failed to withdraw application. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const applications = data?.applications || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <ApplicationsStats applications={applications} />

      {/* Filters and Search */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Search */}
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by company, role, or status..."
                value={currentFilters.search}
                onChange={(e) => updateFilters({ search: e.target.value })}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="shrink-0"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {(currentFilters.status || currentFilters.academicYear) && (
                <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                  {[currentFilters.status, currentFilters.academicYear].filter(Boolean).length}
                </Badge>
              )}
            </Button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchApplications(true)}
              disabled={refreshing}
              className="shrink-0"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            
            {applications.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {pagination?.total} applications
              </div>
            )}
          </div>
        </div>

        {/* Expandable Filters */}
        {showFilters && (
          <ApplicationsFilters
            currentFilters={currentFilters}
            onFiltersChange={updateFilters}
          />
        )}
      </Card>

      {/* Applications List */}
      {applications.length === 0 ? (
        <EmptyState
          icon="file"
          title="No applications found"
          description={
            currentFilters.search || currentFilters.status || currentFilters.academicYear
              ? "Try adjusting your filters to find more applications."
              : "You haven't submitted any applications yet. Browse opportunities to get started!"
          }
          action={
            (!currentFilters.search && !currentFilters.status && !currentFilters.academicYear) ? (
              <Button asChild>
                <a href="/student/opportunities">
                  <FileText className="h-4 w-4 mr-2" />
                  Browse Opportunities
                </a>
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => updateFilters({ search: "", status: "", academicYear: "" })}
              >
                Clear Filters
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4">
          {applications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              onWithdraw={handleWithdrawApplication}
              onViewDetails={(app) => setSelectedApplication(app)}
              refreshing={refreshing}
            />
          ))}
        </div>
      )}

      {/* Load More */}
      {pagination?.hasMore && (
        <div className="flex justify-center pt-6">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}