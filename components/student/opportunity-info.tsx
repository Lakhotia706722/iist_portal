/**
 * Opportunity Info Component — Phase 3
 * Displays detailed information about the opportunity and company
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  MapPin, 
  Building2, 
  Users, 
  Globe,
  Briefcase
} from "lucide-react";

interface OpportunityInfoProps {
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
  };
}

export function OpportunityInfo({ opportunity }: OpportunityInfoProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not specified";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Opportunity Description */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            About This Opportunity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {opportunity.description ? (
            <div className="prose prose-sm max-w-none">
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {opportunity.description}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground italic">
              No detailed description available for this opportunity.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Timeline & Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Timeline & Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Application Period */}
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-2">Application Period</h4>
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="font-medium">Opens:</span>{" "}
                  {formatDate(opportunity.applicationOpenAt)}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Closes:</span>{" "}
                  {formatDate(opportunity.applicationCloseAt)}
                </p>
              </div>
            </div>

            {/* Drive Period */}
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-2">Placement Drive</h4>
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="font-medium">Start:</span>{" "}
                  {formatDate(opportunity.driveStartDate)}
                </p>
                <p className="text-sm">
                  <span className="font-medium">End:</span>{" "}
                  {formatDate(opportunity.driveEndDate)}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Work Details */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Work Mode */}
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-2">Work Mode</h4>
              <Badge 
                variant="secondary" 
                className={
                  opportunity.workMode === "REMOTE" ? "bg-blue-50 text-blue-700" :
                  opportunity.workMode === "HYBRID" ? "bg-orange-50 text-orange-700" : 
                  "bg-green-50 text-green-700"
                }
              >
                {opportunity.workMode.replace("_", " ")}
              </Badge>
            </div>

            {/* Locations */}
            {opportunity.locations.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">
                  <MapPin className="h-4 w-4 inline mr-1" />
                  Work Locations
                </h4>
                <div className="flex flex-wrap gap-1">
                  {opportunity.locations.map((location, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {location}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* About Company */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            About {opportunity.company.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{opportunity.company.industry.replace("_", " ")} Industry</span>
            </div>
            
            {opportunity.company.website && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <a
                  href={opportunity.company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Visit Website
                </a>
              </div>
            )}
          </div>

          {opportunity.company.description ? (
            <div className="prose prose-sm max-w-none">
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {opportunity.company.description}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground italic text-sm">
              No company description available.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}