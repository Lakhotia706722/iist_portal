/**
 * Opportunity Card Component — Phase 3
 * Individual card showing opportunity with countdown timer and eligibility info
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  MapPin, 
  Briefcase, 
  Users, 
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

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

interface OpportunityCardProps {
  opportunity: Opportunity;
  refreshing?: boolean;
}

export function OpportunityCard({ opportunity, refreshing }: OpportunityCardProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days?: number;
    hours?: number;
    minutes?: number;
    status: "active" | "closing_soon" | "closed";
  } | null>(null);

  // Calculate real-time countdown
  useEffect(() => {
    const updateCountdown = () => {
      if (!opportunity.applicationCloseAt) {
        setTimeLeft({ status: "active" });
        return;
      }

      const now = new Date();
      const closeTime = new Date(opportunity.applicationCloseAt);
      const timeDiff = closeTime.getTime() - now.getTime();

      if (timeDiff <= 0) {
        setTimeLeft({ status: "closed" });
      } else if (timeDiff <= 24 * 60 * 60 * 1000) { // Less than 24 hours
        const hours = Math.floor(timeDiff / (60 * 60 * 1000));
        const minutes = Math.floor((timeDiff % (60 * 60 * 1000)) / (60 * 1000));
        setTimeLeft({ hours, minutes, status: "closing_soon" });
      } else {
        const days = Math.ceil(timeDiff / (24 * 60 * 60 * 1000));
        setTimeLeft({ days, status: "active" });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [opportunity.applicationCloseAt]);

  // Format CTC range
  const formatCtcRange = (min: number | null, max: number | null) => {
    if (!min && !max) return "Not disclosed";
    if (min === max) return `₹${(min || 0) / 100000} LPA`;
    if (!min) return `Up to ₹${max! / 100000} LPA`;
    if (!max) return `₹${min / 100000}+ LPA`;
    return `₹${min / 100000} - ${max / 100000} LPA`;
  };

  // Get the CTC range for display
  const ctcRanges = opportunity.jobRoles.map(role => ({
    min: role.ctcMin,
    max: role.ctcMax
  }));
  
  const minCtc = Math.min(...ctcRanges.map(r => r.min || Infinity).filter(c => c !== Infinity));
  const maxCtc = Math.max(...ctcRanges.map(r => r.max || -Infinity).filter(c => c !== -Infinity));
  
  const displayCtc = formatCtcRange(
    minCtc === Infinity ? null : minCtc,
    maxCtc === -Infinity ? null : maxCtc
  );

  // Status styling
  const getStatusBadge = () => {
    const status = timeLeft?.status || opportunity.timeStatus;
    
    switch (status) {
      case "closed":
        return (
          <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Closed
          </Badge>
        );
      case "closing_soon":
        return (
          <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            Closing Soon
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Open
          </Badge>
        );
    }
  };

  // Countdown display
  const getCountdownText = () => {
    if (!timeLeft) return null;
    
    if (timeLeft.status === "closed") {
      return (
        <div className="flex items-center text-sm text-red-600">
          <Clock className="h-4 w-4 mr-1" />
          Applications closed
        </div>
      );
    }
    
    if (timeLeft.hours !== undefined) {
      return (
        <div className="flex items-center text-sm text-amber-600">
          <Clock className="h-4 w-4 mr-1" />
          {timeLeft.hours}h {timeLeft.minutes}m left
        </div>
      );
    }
    
    if (timeLeft.days !== undefined) {
      return (
        <div className="flex items-center text-sm text-green-600">
          <Clock className="h-4 w-4 mr-1" />
          {timeLeft.days} days left
        </div>
      );
    }
    
    return null;
  };

  const isDisabled = timeLeft?.status === "closed";

  return (
    <Card className={cn(
      "group transition-all duration-200 hover:shadow-md",
      refreshing && "opacity-70",
      isDisabled && "opacity-60"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          {/* Company Logo & Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {opportunity.company.logoUrl ? (
              <div className="relative h-12 w-12 rounded-lg border bg-white flex-shrink-0 overflow-hidden">
                <Image
                  src={opportunity.company.logoUrl}
                  alt={`${opportunity.company.name} logo`}
                  fill
                  className="object-contain p-1"
                />
              </div>
            ) : (
              <div className="h-12 w-12 rounded-lg border bg-muted flex items-center justify-center flex-shrink-0">
                <Briefcase className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-base leading-tight group-hover:text-primary transition-colors truncate">
                {opportunity.title}
              </h3>
              <p className="text-sm text-muted-foreground truncate">
                {opportunity.company.name}
              </p>
              <Badge variant="outline" className="text-xs mt-1 inline-block">
                {opportunity.company.industry}
              </Badge>
            </div>
          </div>

          {/* Status Badge */}
          {getStatusBadge()}
        </div>

        {/* Countdown Timer */}
        {getCountdownText()}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Job Roles */}
        <div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
            <Briefcase className="h-4 w-4" />
            {opportunity.jobRoles.length} role{opportunity.jobRoles.length !== 1 ? 's' : ''}
          </div>
          <div className="flex flex-wrap gap-1">
            {opportunity.jobRoles.slice(0, 2).map((role) => (
              <Badge key={role.id} variant="secondary" className="text-xs">
                {role.title}
              </Badge>
            ))}
            {opportunity.jobRoles.length > 2 && (
              <Badge variant="secondary" className="text-xs">
                +{opportunity.jobRoles.length - 2} more
              </Badge>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 gap-2 text-sm">
          {/* CTC */}
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{displayCtc}</span>
          </div>

          {/* Work Mode */}
          <div className="flex items-center gap-2">
            <div className={cn(
              "h-2 w-2 rounded-full",
              opportunity.workMode === "REMOTE" ? "bg-blue-500" :
              opportunity.workMode === "HYBRID" ? "bg-orange-500" : "bg-green-500"
            )} />
            <span className="capitalize">
              {opportunity.workMode.toLowerCase().replace("_", " ")}
            </span>
          </div>

          {/* Location */}
          {opportunity.locations.length > 0 && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">
                {opportunity.locations.slice(0, 2).join(", ")}
                {opportunity.locations.length > 2 && ` +${opportunity.locations.length - 2}`}
              </span>
            </div>
          )}

          {/* Applications */}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{opportunity._count.applications} applications</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <Button 
            asChild={!isDisabled}
            disabled={isDisabled}
            className="w-full"
            variant={timeLeft?.status === "closing_soon" ? "default" : "outline"}
          >
            {isDisabled ? (
              <span>Applications Closed</span>
            ) : (
              <Link href={`/student/opportunities/${opportunity.id}`}>
                View Details & Apply
              </Link>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}