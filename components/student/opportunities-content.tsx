/**
 * Opportunities Content Component — Phase 3
 * Handles data fetching and display of placement opportunities
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OpportunityCard } from "./opportunity-card";
import { OpportunitiesFilters } from "./opportunities-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
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
  const [data, setData] = useState<OpportunitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();

  // Extract current filters from search params
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

  const fetchOpportunities = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const queryParams = new URLSearchParams();
      if (currentFilters.search) queryParams.set("search", currentFilters.search);
      if (currentFilters.industry) queryParams.set("industry", currentFilters.industry);
      if (currentFilters.workMode) queryParams.set("workMode", currentFilters.workMode);
      queryParams.set("limit", currentFilters.limit.toString());
      queryParams.set("offset", currentFilters.offset.toString());

      const response = await fetch(`/api/student/opportunities?${queryParams.toString()}`);

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result: OpportunitiesResponse = await response.json();
      setData(result);

    } catch (error) {
      console.error("Failed to fetch opportunities:", error);
      toast({
        title: "Error",
        description: "Failed to load opportunities. Please try again.",
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
    if (filters.industry) params.set("industry", filters.industry);
    if (filters.workMode) params.set("workMode", filters.workMode);
    if (filters.offset > 0) params.set("offset", filters.offset.toString());

    const queryString = params.toString();
    router.push(`/student/opportunities${queryString ? `?${queryString}` : ""}`);
  };

  // Load more opportunities (pagination)
  const loadMore = () => {
    updateFilters({ offset: currentFilters.offset + currentFilters.limit });
  };

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  // Auto-refresh every 30 seconds to keep countdown timers accurate
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && !refreshing) {
        fetchOpportunities(true);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loading, refreshing, fetchOpportunities]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
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
              onClick={() => fetchOpportunities(true)}
              disabled={refreshing}
              className="shrink-0"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
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