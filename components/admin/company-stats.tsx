/**
 * Company Stats Component — Phase 3
 * 
 * Dashboard stats cards for company overview.
 */

"use client";

import { Building2, TrendingUp, Factory, Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CompanyStatsProps {
  stats: {
    total: number;
    active: number;
    byIndustry: Record<string, number>;
    withActiveDrives: number;
  };
}

const INDUSTRY_LABELS: Record<string, string> = {
  TECHNOLOGY: "Technology",
  FINANCE: "Finance",
  CONSULTING: "Consulting",
  CORE_ENGINEERING: "Core Engineering",
  RESEARCH: "Research",
  DEFENSE: "Defense",
  SPACE: "Space",
  HEALTHCARE: "Healthcare",
  EDUCATION: "Education",
  MANUFACTURING: "Manufacturing",
  OTHER: "Other",
};

export function CompanyStats({ stats }: CompanyStatsProps) {
  const activeRate = stats.total > 0 ? (stats.active / stats.total) * 100 : 0;
  const driveRate = stats.active > 0 ? (stats.withActiveDrives / stats.active) * 100 : 0;

  // Get top 3 industries
  const topIndustries = Object.entries(stats.byIndustry)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([industry, count]) => ({
      industry: INDUSTRY_LABELS[industry] || industry,
      count,
    }));

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Companies */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
          <p className="text-xs text-muted-foreground">
            {stats.active} active ({activeRate.toFixed(0)}%)
          </p>
        </CardContent>
      </Card>

      {/* Active Companies */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Companies</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.active}</div>
          <p className="text-xs text-muted-foreground">
            {stats.withActiveDrives} with active drives
          </p>
        </CardContent>
      </Card>

      {/* Companies with Active Drives */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Drives</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.withActiveDrives}</div>
          <p className="text-xs text-muted-foreground">
            {driveRate.toFixed(0)}% of active companies
          </p>
        </CardContent>
      </Card>

      {/* Top Industries */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Top Industries</CardTitle>
          <Factory className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topIndustries.length > 0 ? (
              topIndustries.map((item, index) => (
                <div key={item.industry} className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {index + 1}. {item.industry}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {item.count}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No data available</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}