/**
 * Opportunity Header Component — Phase 3
 * Displays company info, opportunity title, and key details
 */

"use client";

import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Building2, 
  MapPin, 
  Calendar, 
  Clock,
  ExternalLink,
  Briefcase
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OpportunityHeaderProps {
  opportunity: {
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
  };
}

export function OpportunityHeader({ opportunity }: OpportunityHeaderProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not specified";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = () => {
    switch (opportunity.timeStatus) {
      case "closed":
        return (
          <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200">
            <Clock className="h-3 w-3 mr-1" />
            Applications Closed
          </Badge>
        );
      case "closing_soon":
        return (
          <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
            <Clock className="h-3 w-3 mr-1" />
            Closing Soon
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
            <Clock className="h-3 w-3 mr-1" />
            Applications Open
          </Badge>
        );
    }
  };

  const getCountdownText = () => {
    if (opportunity.timeStatus === "closed") return null;
    
    if (!opportunity.timeRemaining) return null;
    
    if (opportunity.timeStatus === "closing_soon") {
      return `${opportunity.timeRemaining}h left`;
    }
    
    return `${opportunity.timeRemaining} days left`;
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
          <div className="flex items-start gap-6">
            {/* Company Logo */}
            <div className="flex-shrink-0">
              {opportunity.company.logoUrl ? (
                <div className="relative h-20 w-20 rounded-xl border bg-white p-2 shadow-sm">
                  {/* unoptimized: see ARCHITECTURE.md §13 — company.logoUrl's declared
                      MIME type isn't server-verified against actual bytes. */}
                  <Image
                    src={opportunity.company.logoUrl}
                    alt={`${opportunity.company.name} logo`}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="h-20 w-20 rounded-xl border bg-white flex items-center justify-center shadow-sm">
                  <Building2 className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Main Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">
                    {opportunity.title}
                  </h1>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="text-lg font-semibold text-gray-700">
                      {opportunity.company.name}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {opportunity.company.industry.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
                
                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  {getStatusBadge()}
                  {getCountdownText() && (
                    <span className="text-sm font-medium text-muted-foreground">
                      {getCountdownText()}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              {opportunity.description && (
                <p className="text-gray-600 mb-4 line-clamp-2">
                  {opportunity.description}
                </p>
              )}

              {/* Quick Details */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {/* Work Mode */}
                <div className="flex items-center gap-1">
                  <Briefcase className="h-4 w-4" />
                  <span className="capitalize">
                    {opportunity.workMode.toLowerCase().replace("_", " ")}
                  </span>
                </div>

                {/* Locations */}
                {opportunity.locations.length > 0 && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {opportunity.locations.slice(0, 2).join(", ")}
                      {opportunity.locations.length > 2 && ` +${opportunity.locations.length - 2}`}
                    </span>
                  </div>
                )}

                {/* Application Deadline */}
                {opportunity.applicationCloseAt && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>Deadline: {formatDate(opportunity.applicationCloseAt)}</span>
                  </div>
                )}

                {/* Company Website */}
                {opportunity.company.website && (
                  <Button variant="ghost" size="sm" asChild className="h-auto p-0 text-primary hover:text-primary/80">
                    <a 
                      href={opportunity.company.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Company Website
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}