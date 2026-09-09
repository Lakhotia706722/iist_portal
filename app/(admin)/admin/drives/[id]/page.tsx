/**
 * Admin Drive Detail Page — Phase 3
 * 
 * Detailed drive view with tabbed interface for comprehensive management.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Edit, 
  Building2, 
  Calendar, 
  MapPin, 
  Users, 
  Clock,
  FileText,
  Target,
  BarChart3,
  UserCheck,
  Presentation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { DriveForm } from "@/components/admin/drive-form";
import { DriveOverview } from "@/components/admin/drive-overview";
import { DriveJobRoles } from "@/components/admin/drive-job-roles";
import { DriveApplications } from "@/components/admin/drive-applications";
import { DriveRounds } from "@/components/admin/drive-rounds";
import { DriveShortlisting } from "@/components/admin/drive-shortlisting";
import { DriveAttendance } from "@/components/admin/drive-attendance";
import { DriveDashboard } from "@/components/admin/drive-dashboard";
import { DrivePrePlacementTalk } from "@/components/admin/drive-ppt";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface DriveDetail {
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
  bond: string | null;
  selectionProcess: string | null;
  perksAndBenefits: string | null;
  pointOfContact: string | null;
  pocEmail: string | null;
  pocPhone: string | null;
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

interface DriveDetailPageProps {
  params: { id: string };
}

export default function DriveDetailPage({ params }: DriveDetailPageProps) {
  const [drive, setDrive] = useState<DriveDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const router = useRouter();
  const { toast } = useToast();

  const fetchDriveDetail = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/drives/${params.id}`);
      if (!response.ok) throw new Error("Failed to fetch drive details");

      const data = await response.json();
      setDrive(data.drive);
    } catch (error) {
      console.error("Error fetching drive details:", error);
      toast({
        title: "Error",
        description: "Failed to load drive details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [params.id, toast]);

  useEffect(() => {
    fetchDriveDetail();
  }, [fetchDriveDetail]);

  const handleEditDrive = () => {
    setShowEditDialog(true);
  };

  const handleDriveUpdate = async () => {
    setShowEditDialog(false);
    await fetchDriveDetail();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!drive) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Drive Not Found</h1>
          <p className="text-muted-foreground">The requested drive could not be found.</p>
          <Button onClick={() => router.push("/admin/drives")} className="mt-4">
            Back to Drives
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push("/admin/drives")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Drives
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleEditDrive} className="gap-2">
            <Edit className="h-4 w-4" />
            Edit Drive
          </Button>
        </div>
      </div>

      {/* Drive Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={drive.company.logoUrl || ""} alt={drive.company.name} />
                <AvatarFallback>
                  {drive.company.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-2xl">{drive.title}</CardTitle>
                  <Badge variant={getStatusBadge(drive.status).variant}>
                    {getStatusBadge(drive.status).label}
                  </Badge>
                </div>
                
                <CardDescription className="flex items-center gap-4 text-base">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    {drive.company.name}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {drive.academicYear}
                  </span>
                  <span>•</span>
                  <span className="capitalize">{drive.workMode.toLowerCase()}</span>
                </CardDescription>

                {drive.locations.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{drive.locations.join(", ")}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{drive._count.jobRoles}</div>
              <div className="text-sm text-muted-foreground">Job Roles</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{drive._count.applications}</div>
              <div className="text-sm text-muted-foreground">Applications</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{drive._count.rounds}</div>
              <div className="text-sm text-muted-foreground">Rounds</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {drive.applicationCloseAt ? (
                  <>
                    {Math.max(0, Math.ceil((new Date(drive.applicationCloseAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))}
                  </>
                ) : (
                  "--"
                )}
              </div>
              <div className="text-sm text-muted-foreground">Days to Close</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview" className="gap-1">
            <FileText className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1">
            <Target className="h-4 w-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="applications" className="gap-1">
            <Users className="h-4 w-4" />
            Applications
          </TabsTrigger>
          <TabsTrigger value="rounds" className="gap-1">
            <Clock className="h-4 w-4" />
            Rounds
          </TabsTrigger>
          <TabsTrigger value="shortlisting" className="gap-1">
            <UserCheck className="h-4 w-4" />
            Shortlisting
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-1">
            <Calendar className="h-4 w-4" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="ppt" className="gap-1">
            <Presentation className="h-4 w-4" />
            <span className="hidden sm:inline">PPT</span>
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="overview">
            <DriveOverview drive={drive} onUpdate={fetchDriveDetail} />
          </TabsContent>

          <TabsContent value="roles">
            <DriveJobRoles driveId={drive.id} driveStatus={drive.status} />
          </TabsContent>

          <TabsContent value="applications">
            <DriveApplications driveId={drive.id} />
          </TabsContent>

          <TabsContent value="rounds">
            <DriveRounds driveId={drive.id} driveStatus={drive.status} />
          </TabsContent>

          <TabsContent value="shortlisting">
            <DriveShortlisting driveId={drive.id} />
          </TabsContent>

          <TabsContent value="attendance">
            <DriveAttendance driveId={drive.id} />
          </TabsContent>

          <TabsContent value="ppt">
            <DrivePrePlacementTalk driveId={drive.id} />
          </TabsContent>

          <TabsContent value="dashboard">
            <DriveDashboard driveId={drive.id} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Drive</DialogTitle>
            <DialogDescription>
              Update drive information and settings.
            </DialogDescription>
          </DialogHeader>
          <DriveForm
            drive={drive}
            onSuccess={handleDriveUpdate}
            onCancel={() => setShowEditDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}