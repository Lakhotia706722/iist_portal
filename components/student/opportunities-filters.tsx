/**
 * Opportunities Filters Component — Phase 3
 * Advanced filtering for opportunities listing
 */

"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface OpportunitiesFiltersProps {
  currentFilters: {
    search: string;
    industry: string;
    workMode: string;
  };
  onFiltersChange: (filters: Partial<{
    search: string;
    industry: string;
    workMode: string;
  }>) => void;
}

export function OpportunitiesFilters({
  currentFilters,
  onFiltersChange,
}: OpportunitiesFiltersProps) {
  const industries = [
    "TECHNOLOGY",
    "FINANCE", 
    "HEALTHCARE",
    "CONSULTING",
    "MANUFACTURING",
    "RETAIL",
    "EDUCATION",
    "GOVERNMENT",
    "NON_PROFIT",
    "OTHER"
  ];

  const workModes = [
    "ON_SITE",
    "REMOTE", 
    "HYBRID"
  ];

  const formatLabel = (value: string) => {
    return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  const clearFilter = (key: keyof typeof currentFilters) => {
    onFiltersChange({ [key]: "" });
  };

  const clearAllFilters = () => {
    onFiltersChange({ search: "", industry: "", workMode: "" });
  };

  const hasActiveFilters = currentFilters.industry || currentFilters.workMode;

  return (
    <div className="border-t pt-4 mt-4 space-y-4">
      {/* Filter Controls */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Industry Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Industry</label>
          <Select 
            value={currentFilters.industry} 
            onValueChange={(value) => onFiltersChange({ industry: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All industries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All industries</SelectItem>
              {industries.map((industry) => (
                <SelectItem key={industry} value={industry}>
                  {formatLabel(industry)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Work Mode Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Work Mode</label>
          <Select 
            value={currentFilters.workMode} 
            onValueChange={(value) => onFiltersChange({ workMode: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All modes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All modes</SelectItem>
              {workModes.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {formatLabel(mode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Clear All Button */}
        <div className="flex items-end">
          <Button
            variant="outline"
            onClick={clearAllFilters}
            disabled={!hasActiveFilters}
            className="w-full"
          >
            Clear All Filters
          </Button>
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Active Filters:</label>
          <div className="flex flex-wrap gap-2">
            {currentFilters.industry && (
              <Badge variant="secondary" className="gap-1">
                Industry: {formatLabel(currentFilters.industry)}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 hover:bg-transparent"
                  onClick={() => clearFilter("industry")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
            
            {currentFilters.workMode && (
              <Badge variant="secondary" className="gap-1">
                Mode: {formatLabel(currentFilters.workMode)}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 hover:bg-transparent"
                  onClick={() => clearFilter("workMode")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}