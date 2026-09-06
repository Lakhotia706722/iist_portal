/**
 * Admin Companies Page — Phase 3
 * 
 * Company management with CRUD operations, logo upload, and filtering.
 */

"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Filter, MoreHorizontal, Building2, Globe, MapPin, Users } from "lucide-react";
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
import { CompanyForm } from "@/components/admin/company-form";
import { CompanyStats } from "@/components/admin/company-stats";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";

interface Company {
  id: string;
  name: string;
  slug: string;
  industry: string;
  description: string | null;
  website: string | null;
  location: string | null;
  headcount: string | null;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    drives: number;
    activeDrives: number;
  };
}

interface CompanyStats {
  total: number;
  active: number;
  byIndustry: Record<string, number>;
  withActiveDrives: number;
}

const INDUSTRY_OPTIONS = [
  { value: "TECHNOLOGY", label: "Technology" },
  { value: "FINANCE", label: "Finance" },
  { value: "CONSULTING", label: "Consulting" },
  { value: "CORE_ENGINEERING", label: "Core Engineering" },
  { value: "RESEARCH", label: "Research" },
  { value: "DEFENSE", label: "Defense" },
  { value: "SPACE", label: "Space" },
  { value: "HEALTHCARE", label: "Healthcare" },
  { value: "EDUCATION", label: "Education" },
  { value: "MANUFACTURING", label: "Manufacturing" },
  { value: "OTHER", label: "Other" },
];

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    fetchCompanies();
  }, [searchQuery, industryFilter, statusFilter]);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (searchQuery) params.set("search", searchQuery);
      if (industryFilter !== "all") params.set("industry", industryFilter);
      if (statusFilter !== "all") params.set("isActive", statusFilter);
      params.set("includeStats", "true");

      const response = await fetch(`/api/admin/companies?${params}`);
      if (!response.ok) throw new Error("Failed to fetch companies");

      const data = await response.json();
      setCompanies(data.companies);
      setStats(data.stats);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast({
        title: "Error",
        description: "Failed to load companies",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = () => {
    setSelectedCompany(null);
    setShowCreateDialog(true);
  };

  const handleEditCompany = (company: Company) => {
    setSelectedCompany(company);
    setShowEditDialog(true);
  };

  const handleToggleStatus = async (company: Company) => {
    try {
      setActionLoading(company.id);
      
      const response = await fetch(`/api/admin/companies/${company.id}?action=toggle-status`, {
        method: "PUT",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update company status");
      }

      await fetchCompanies();
      toast({
        title: "Success",
        description: `Company ${company.isActive ? "deactivated" : "activated"} successfully`,
      });
    } catch (error) {
      console.error("Error toggling company status:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update company status",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCompany = async (company: Company) => {
    if (!confirm(`Are you sure you want to delete ${company.name}?`)) return;

    try {
      setActionLoading(company.id);
      
      const response = await fetch(`/api/admin/companies/${company.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete company");
      }

      await fetchCompanies();
      toast({
        title: "Success",
        description: "Company deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting company:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete company",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompanySubmit = async () => {
    setShowCreateDialog(false);
    setShowEditDialog(false);
    await fetchCompanies();
  };

  const getIndustryLabel = (industry: string) => {
    return INDUSTRY_OPTIONS.find(opt => opt.value === industry)?.label || industry;
  };

  const filteredCompanies = companies.filter(company => {
    const matchesSearch = !searchQuery || 
      company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesIndustry = industryFilter === "all" || company.industry === industryFilter;
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "true" ? company.isActive : !company.isActive);

    return matchesSearch && matchesIndustry && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Companies</h1>
          <p className="text-muted-foreground">Manage companies and their placement drives</p>
        </div>
        <Button onClick={handleCreateCompany} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Company
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && <CompanyStats stats={stats} />}

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
                  placeholder="Search companies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                {INDUSTRY_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Companies Grid */}
      {filteredCompanies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies found"
          description="Get started by adding your first company."
          action={{
            label: "Add Company",
            onClick: handleCreateCompany,
          }}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCompanies.map((company) => (
            <Card key={company.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={company.logoUrl || ""} alt={company.name} />
                      <AvatarFallback>
                        {company.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{company.name}</CardTitle>
                      <Badge variant={company.isActive ? "default" : "secondary"}>
                        {company.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionLoading === company.id}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditCompany(company)}>
                        Edit Company
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleStatus(company)}>
                        {company.isActive ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDeleteCompany(company)}
                        className="text-destructive"
                      >
                        Delete Company
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4" />
                    <span>{getIndustryLabel(company.industry)}</span>
                  </div>
                  
                  {company.location && (
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-4 w-4" />
                      <span>{company.location}</span>
                    </div>
                  )}
                  
                  {company.headcount && (
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4" />
                      <span>{company.headcount} employees</span>
                    </div>
                  )}
                  
                  {company.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <a 
                        href={company.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate"
                      >
                        {company.website.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  )}
                </div>

                {company.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {company.description}
                  </p>
                )}

                <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                  <span>{company._count.drives} drives</span>
                  <span>{company._count.activeDrives} active</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialogs */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Company</DialogTitle>
            <DialogDescription>
              Create a new company profile for placement drives.
            </DialogDescription>
          </DialogHeader>
          <CompanyForm
            onSuccess={handleCompanySubmit}
            onCancel={() => setShowCreateDialog(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>
              Update company information and settings.
            </DialogDescription>
          </DialogHeader>
          {selectedCompany && (
            <CompanyForm
              company={selectedCompany}
              onSuccess={handleCompanySubmit}
              onCancel={() => setShowEditDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}