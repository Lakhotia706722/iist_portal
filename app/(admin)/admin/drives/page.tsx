/**
 * Admin Drives Page — Phase 3
 * 
 * Placement drives management with filtering and CRUD operations.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Filter, Calendar, Building2, Users, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { DriveForm } from "@/components/admin/drive-form";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";

interface Drive {
  id: string;
  companyId: string;
  title: string;
  academicYear: string;
  status: string;
  description: string | null;
  applicationOpenAt: string | null;
  applicationCloseAt: string | null;
  driveStartDate: string | null;
  driveEndDate: string | null;
  workMode: string;
  locations: string[];
  createdAt: string;
  updatedAt: string;
  company: {
    id: string;
    name: string;
    slug: string;
    industry: string;
    logoUrl: string | null;
  };
  _count: {
    jobRoles: number;
    applications: number;
    rounds: number;
  };
}

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft", color: "gray" },
  { value: "PUBLISHED", label: "Published", color: "blue" },
  { value: "APPLICATIONS_OPEN", label: "Applications Open", color: "green" },
  { value: "APPLICATIONS_CLOSED", label: "Applications Closed", color: "yellow" },
  { value: "ONGOING", label: "Ongoing", color: "orange" },
  { value: "COMPLETED", label: "Completed", color: "purple" },
  { value: "CANCELLED", label: "Cancelled", color: "red" },
];

const WORK_MODE_OPTIONS = [
  { value: "ONSITE", label: "On-site" },
  { value: "REMOTE", label: "Remote" },
  { value: "HYBRID", label: "Hybrid" },
];

export default function DrivesPage() {
  const [drives, setDrives] = useState<Drive[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [academicYearFilter, setAcademicYearFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  const fetchDrives = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const params = new URLSearchParams();

      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (academicYearFilter !== "all") params.set("academicYear", academicYearFilter);

      const response = await fetch(`/api/admin/drives?${params}`);
      if (!response.ok) throw new Error("Failed to fetch drives");

      const data = await response.json();
      setDrives(data.drives);
    } catch (err) {
      // Phase 11: same fetch-failure-looks-like-empty-list bug found and
      // fixed on admin/companies and student/opportunities — this page
      // shares the identical pre-error-state-convention pattern.
      console.error("Error fetching drives:", err);
      setError(true);
      toast({
        title: "Error",
        description: "Failed to load drives",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, academicYearFilter, toast]);

  useEffect(() => {
    fetchDrives();
  }, [fetchDrives]);

  const handleCreateDrive = () => {
    setShowCreateDialog(true);
  };

  const handleViewDrive = (drive: Drive) => {
    router.push(`/admin/drives/${drive.id}`);
  };

  const handleUpdateStatus = async (drive: Drive, newStatus: string) => {
    try {
      setActionLoading(drive.id);
      
      const response = await fetch(`/api/admin/drives/${drive.id}?action=update-status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update drive status");
      }

      await fetchDrives();
      toast({
        title: "Success",
        description: `Drive status updated to ${newStatus}`,
      });
    } catch (error) {
      console.error("Error updating drive status:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update drive status",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteDrive = async (drive: Drive) => {
    if (!confirm(`Are you sure you want to delete "${drive.title}"?`)) return;

    try {
      setActionLoading(drive.id);
      
      const response = await fetch(`/api/admin/drives/${drive.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete drive");
      }

      await fetchDrives();
      toast({
        title: "Success",
        description: "Drive deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting drive:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete drive",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDriveSubmit = async () => {
    setShowCreateDialog(false);
    await fetchDrives();
  };

  const getStatusBadge = (status: string) => {
    const statusOption = STATUS_OPTIONS.find(opt => opt.value === status);
    return statusOption ? { label: statusOption.label, variant: getStatusVariant(status) } : { label: status, variant: "secondary" as const };
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "APPLICATIONS_OPEN": return "default";
      case "ONGOING": return "default";
      case "COMPLETED": return "secondary";
      case "CANCELLED": return "destructive";
      default: return "outline";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleDateString();
  };

  const getAvailableStatusTransitions = (currentStatus: string) => {
    const transitions: Record<string, string[]> = {
      DRAFT: ["PUBLISHED"],
      PUBLISHED: ["APPLICATIONS_OPEN"],
      APPLICATIONS_OPEN: ["APPLICATIONS_CLOSED"],
      APPLICATIONS_CLOSED: ["ONGOING"],
      ONGOING: ["COMPLETED"],
    };
    return transitions[currentStatus] || [];
  };

  // Get unique academic years from drives
  const academicYears = Array.from(new Set(drives.map(d => d.academicYear))).sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return <ErrorState onRetry={fetchDrives} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Placement Drives</h1>
          <p className="text-muted-foreground">Manage placement drives and recruitment processes</p>
        </div>
        <Button onClick={handleCreateDrive} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Drive
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Drives</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{drives.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Drives</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {drives.filter(d => ["APPLICATIONS_OPEN", "ONGOING"].includes(d.status)).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {drives.reduce((sum, d) => sum + d._count.applications, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(drives.map(d => d.companyId)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search drives..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUS_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={academicYearFilter} onValueChange={setAcademicYearFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Academic Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {academicYears.map(year => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Drives List */}
      {drives.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No drives found"
          description="Get started by creating your first placement drive."
          action={{
            label: "Create Drive",
            onClick: handleCreateDrive,
          }}
        />
      ) : (
        <div className="space-y-4">
          {drives.map((drive) => (
            <Card key={drive.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={drive.company.logoUrl || ""} alt={drive.company.name} />
                      <AvatarFallback>
                        {drive.company.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-lg hover:text-primary" onClick={() => handleViewDrive(drive)}>
                          {drive.title}
                        </CardTitle>
                        <Badge variant={getStatusBadge(drive.status).variant}>
                          {getStatusBadge(drive.status).label}
                        </Badge>
                      </div>
                      <CardDescription className="flex items-center gap-4">
                        <span>{drive.company.name}</span>
                        <span>•</span>
                        <span>{drive.academicYear}</span>
                        <span>•</span>
                        <span>{WORK_MODE_OPTIONS.find(w => w.value === drive.workMode)?.label}</span>
                      </CardDescription>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionLoading === drive.id}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleViewDrive(drive)}>
                        View Details
                      </DropdownMenuItem>
                      
                      {getAvailableStatusTransitions(drive.status).map(status => (
                        <DropdownMenuItem 
                          key={status}
                          onClick={() => handleUpdateStatus(drive, status)}
                        >
                          Change to {STATUS_OPTIONS.find(s => s.value === status)?.label}
                        </DropdownMenuItem>
                      ))}
                      
                      {getAvailableStatusTransitions(drive.status).length > 0 && (
                        <DropdownMenuSeparator />
                      )}
                      
                      {drive.status === "DRAFT" && (
                        <DropdownMenuItem 
                          onClick={() => handleDeleteDrive(drive)}
                          className="text-destructive"
                        >
                          Delete Drive
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Applications Open</p>
                    <p className="font-medium">{formatDate(drive.applicationOpenAt)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Applications Close</p>
                    <p className="font-medium">{formatDate(drive.applicationCloseAt)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Drive Start</p>
                    <p className="font-medium">{formatDate(drive.driveStartDate)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Drive End</p>
                    <p className="font-medium">{formatDate(drive.driveEndDate)}</p>
                  </div>
                </div>

                {drive.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {drive.description}
                  </p>
                )}

                <div className="flex justify-between items-center pt-2 border-t">
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{drive._count.jobRoles} roles</span>
                    <span>{drive._count.applications} applications</span>
                    <span>{drive._count.rounds} rounds</span>
                  </div>
                  
                  {drive.locations.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      📍 {drive.locations.slice(0, 2).join(", ")}
                      {drive.locations.length > 2 && ` +${drive.locations.length - 2}`}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Drive</DialogTitle>
            <DialogDescription>
              Create a new placement drive for a company.
            </DialogDescription>
          </DialogHeader>
          <DriveForm
            onSuccess={handleDriveSubmit}
            onCancel={() => setShowCreateDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}