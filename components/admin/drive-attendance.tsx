/**
 * Drive Attendance Component — Phase 3
 * 
 * Manage attendance for drive rounds.
 */

"use client";

import { useState, useEffect } from "react";
import { Calendar, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";

interface DriveAttendanceProps {
  driveId: string;
}

export function DriveAttendance({ driveId }: DriveAttendanceProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => setLoading(false), 1000);
  }, [driveId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Attendance</h2>
          <p className="text-muted-foreground">Track attendance across all rounds</p>
        </div>
        
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      <EmptyState
        icon={Calendar}
        title="Attendance tracking"
        description="This section will show attendance records for all rounds in this drive."
      />
    </div>
  );
}