/**
 * Opportunities Content Component — Phase 3
 * Handles data fetching and display of placement opportunities
 *
 * Phase 15 — converted from a raw useState/useEffect/setInterval poll to
 * TanStack Query so it participates in the same refetchInterval /
 * refetchIntervalInBackground / notification-fast-path convention as every
 * other "live" query in the app, instead of its own bespoke 30s timer that
 * kept running even when the tab was backgrounded.
 */

"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OpportunityCard } from "./opportunity-card";
import { OpportunitiesFilters } from "./opportunities-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Search, Filter, RefreshCw } from "lucide-react";

interface Opportunity {
  id: string;
  title: string;
  company: {
    name: string;
    industry: string;
    logoUrl: string | null;
  };
  workMode: string;
  locations: string[];
  applicationCloseAt: string | null;
  timeStatus: "active" | "closing_soon" | "closed";
  timeRemaining: number | null;
  jobRoles: Array<{
    id: string;
    title: string;
    ctcMin: number | null;
    ctcMax: number | null;
  }>;
  _count: {
    applications: number;
  };
}

interface OpportunitiesResponse {
  opportunities: Opportunity[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export function OpportunitiesContent({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const [showFilters, setShowFilters] = useState(false);
  const router = useRouter();

  const currentFilters = useMemo(
    () => ({
      search: (searchParams.search as string) || "",
      industry: (searchParams.industry as string) || "",
      workMode: (searchParams.workMode as string) || "",
      limit: 20,
      offset: parseInt((searchParams.offset as string) || "0"),
    }),
    [searchParams]
  );

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["student-opportunities", currentFilters],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (currentFilters.search) queryParams.set("search", currentFilters.search);
      if (currentFilters.industry) queryParams.set("industry", currentFilters.industry);
      if (currentFilters.workMode) queryParams.set("workMode", currentFilters.workMode);
      queryParams.set("limit", currentFilters.limit.toString());
      queryParams.set("offset", currentFilters.offset.toString());

      const response = await fetch(`/api/student/opportunities?${queryParams.toString()}`);
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()) as OpportunitiesResponse;
    },
    // Live — another role (admin) publishing a drive or a company/admin
    // closing applications must show up here without a manual reload.
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  const updateFilters = (newFilters: Partial<typeof currentFilters>) => {
    const params = new URLSearchParams();
    const filters = { ...currentFilters, ...newFilters, offset: 0 };
    if (filters.search) params.set("search", filters.search);
    if (filters.industry) params.set("industry", filters.industry);
    if (filters.workMode) params.set("workMode", filters.workMode);
    if (filters.offset > 0) params.set("offset", filters.offset.toString());
    const queryString = params.toString();
    router.push(`/student/opportunities${queryString ? `?${queryString}` : ""}`);
  };

  const loadMore = () => {
    updateFilters({ offset: currentFilters.offset + currentFilters.limit });
  };

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isError && !data) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  const opportunities = data?.opportunities || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Search */}
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search opportunities, companies, or roles..."
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
              {(currentFilters.industry || currentFilters.workMode) && (
                <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                  {[currentFilters.industry, currentFilters.workMode].filter(Boolean).length}
                </Badge>
              )}
            </Button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="shrink-0"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            {opportunities.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {pagination?.total} opportunities
              </div>
            )}
          </div>
        </div>

        {/* Expandable Filters */}
        {showFilters && (
          <OpportunitiesFilters
            currentFilters={currentFilters}
            onFiltersChange={updateFilters}
          />
        )}
      </Card>

      {/* Opportunities Grid */}
      {opportunities.length === 0 ? (
        <EmptyState
          icon="briefcase"
          title="No opportunities found"
          description={
            currentFilters.search || currentFilters.industry || currentFilters.workMode
              ? "Try adjusting your filters to find more opportunities."
              : "New opportunities will appear here when companies open applications."
          }
          action={
            (currentFilters.search || currentFilters.industry || currentFilters.workMode) ? (
              <Button
                variant="outline"
                onClick={() => updateFilters({ search: "", industry: "", workMode: "" })}
              >
                Clear Filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {opportunities.map((opportunity) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              refreshing={isFetching}
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
            disabled={isLoading}
          >
            {isLoading ? (
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
