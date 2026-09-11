/**
 * Drive Job Roles Component — Phase 3
 * 
 * Manage job roles and eligibility criteria for a drive.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Target, Edit, Trash2, Users, DollarSign, ShieldCheck } from "lucide-react";
import { EligibilityRulesDialog } from "@/components/admin/eligibility-rules-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { JobRoleForm } from "@/components/admin/job-role-form";

interface JobRole {
  id: string;
  title: string;
  description: string | null;
  ctcMin: number | null;
  ctcMax: number | null;
  openings: number | null;
  skills: string[];
  workMode: string;
  locations: string[];
  isActive: boolean;
  eligibilityRules: Array<{
    id: string;
    field: string;
    operator: string;
    value: string;
    label: string;
    isActive: boolean;
  }>;
  _count: {
    applications: number;
    eligibilityRules: number;
  };
}

interface DriveJobRolesProps {
  driveId: string;
  driveStatus: string;
}

export function DriveJobRoles({ driveId, driveStatus }: DriveJobRolesProps) {
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<JobRole | null>(null);
  const [deletingRole, setDeletingRole] = useState<JobRole | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [eligibilityRole, setEligibilityRole] = useState<JobRole | null>(null);

  const { toast } = useToast();

  const fetchJobRoles = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const response = await fetch(`/api/admin/drives/${driveId}/roles`);
      if (!response.ok) throw new Error("Failed to fetch job roles");

      const data = await response.json();
      setJobRoles(data.jobRoles);
    } catch (err) {
      // Phase 11: same fetch-failure-looks-like-empty-list bug found on
      // admin/companies and student/opportunities.
      console.error("Error fetching job roles:", err);
      setError(true);
      toast({
        title: "Error",
        description: "Failed to load job roles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [driveId, toast]);

  useEffect(() => {
    fetchJobRoles();
  }, [fetchJobRoles]);

  const canEdit = !["ONGOING", "COMPLETED", "CANCELLED"].includes(driveStatus);

  const handleDelete = async () => {
    if (!deletingRole) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/admin/drives/${driveId}/roles/${deletingRole.id}`, { method: "DELETE" });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete job role");
      }
      toast({ title: "Success", description: "Job role deleted" });
      setDeletingRole(null);
      fetchJobRoles();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete job role",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) return "Not specified";
    if (min && max) return `₹${min}L - ₹${max}L`;
    if (min) return `₹${min}L+`;
    if (max) return `Up to ₹${max}L`;
    return "Not specified";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return <ErrorState onRetry={fetchJobRoles} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Job Roles & Eligibility</h2>
          <p className="text-muted-foreground">Manage available positions and their requirements</p>
        </div>
        
        {canEdit && (
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Job Role
          </Button>
        )}
      </div>

      {/* Job Roles List */}
      {jobRoles.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No job roles defined"
          description="Start by adding job roles for this placement drive."
          action={canEdit ? {
            label: "Add Job Role",
            onClick: () => setShowCreateDialog(true),
          } : undefined}
        />
      ) : (
        <div className="grid gap-6">
          {jobRoles.map((role) => (
            <Card key={role.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{role.title}</CardTitle>
                      <Badge variant={role.isActive ? "default" : "secondary"}>
                        {role.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        {formatSalary(role.ctcMin, role.ctcMax)}
                      </span>
                      
                      {role.openings && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {role.openings} openings
                          </span>
                        </>
                      )}
                      
                      <span>•</span>
                      <span>{role._count.applications} applications</span>
                    </div>
                  </div>
                  
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => setEligibilityRole(role)}>
                        <ShieldCheck className="h-4 w-4" />
                        Eligibility
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => setEditingRole(role)}>
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => setDeletingRole(role)}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {role.description && (
                  <p className="text-sm text-muted-foreground">{role.description}</p>
                )}
                
                {role.skills.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Required Skills</h4>
                    <div className="flex flex-wrap gap-1">
                      {role.skills.map((skill, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {role.eligibilityRules.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Eligibility Criteria ({role.eligibilityRules.length} rules)</h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {role.eligibilityRules.slice(0, 4).map((rule) => (
                        <div key={rule.id} className="text-xs bg-muted p-2 rounded">
                          {rule.label}
                        </div>
                      ))}
                      {role.eligibilityRules.length > 4 && (
                        <div className="text-xs text-muted-foreground p-2">
                          +{role.eligibilityRules.length - 4} more rules...
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No eligibility rules set — every student can apply.
                    {canEdit && " Use the “Eligibility” button above to restrict by branch, CGPA, etc."}
                  </p>
                )}
                
                {role.locations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Work Locations</h4>
                    <div className="flex flex-wrap gap-1">
                      {role.locations.map((location, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {location}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Job Role</DialogTitle>
            <DialogDescription>
              Create a new job role for this placement drive.
            </DialogDescription>
          </DialogHeader>
          <JobRoleForm
            driveId={driveId}
            onSuccess={() => { setShowCreateDialog(false); fetchJobRoles(); }}
            onCancel={() => setShowCreateDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Job Role</DialogTitle>
            <DialogDescription>Update this role&apos;s details.</DialogDescription>
          </DialogHeader>
          {editingRole && (
            <JobRoleForm
              driveId={driveId}
              role={editingRole}
              onSuccess={() => { setEditingRole(null); fetchJobRoles(); }}
              onCancel={() => setEditingRole(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingRole}
        onOpenChange={(open) => !open && setDeletingRole(null)}
        title="Delete job role?"
        description={`This will permanently delete "${deletingRole?.title}". Applications already submitted against it are not affected, but no one can apply to it going forward.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />

      {eligibilityRole && (
        <EligibilityRulesDialog
          driveId={driveId}
          jobRoleId={eligibilityRole.id}
          jobRoleTitle={eligibilityRole.title}
          rules={eligibilityRole.eligibilityRules}
          open={!!eligibilityRole}
          onOpenChange={(open) => !open && setEligibilityRole(null)}
          onSaved={fetchJobRoles}
        />
      )}
    </div>
  );
}