/**
 * Drive Overview Component — Phase 3
 * 
 * Overview tab showing drive details and timeline.
 */

"use client";

import { Calendar, Clock, MapPin, Phone, Mail, User, FileText, Award } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DriveOverviewProps {
  drive: {
    id: string;
    title: string;
    description: string | null;
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
    };
  };
  onUpdate: () => void;
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

  return (
    <div className="space-y-6">
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