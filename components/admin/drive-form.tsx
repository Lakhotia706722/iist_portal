/**
 * Drive Form Component — Phase 3
 * 
 * Form for creating and editing placement drives.
 */

"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { driveSchema } from "@/lib/validations/placement";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { z } from "zod";

type DriveFormData = z.infer<typeof driveSchema>;

interface Company {
  id: string;
  name: string;
  slug: string;
  industry: string;
  logoUrl: string | null;
  isActive: boolean;
}

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
  bond: string | null;
  selectionProcess: string | null;
  perksAndBenefits: string | null;
  pointOfContact: string | null;
  pocEmail: string | null;
  pocPhone: string | null;
}

interface DriveFormProps {
  drive?: Drive;
  onSuccess: () => void;
  onCancel: () => void;
}

const WORK_MODE_OPTIONS = [
  { value: "ONSITE", label: "On-site" },
  { value: "REMOTE", label: "Remote" },
  { value: "HYBRID", label: "Hybrid" },
];

const ACADEMIC_YEARS = [
  "2024-2025",
  "2025-2026",
  "2026-2027",
  "2027-2028",
];

export function DriveForm({ drive, onSuccess, onCancel }: DriveFormProps) {
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [locationInput, setLocationInput] = useState("");
  
  const { toast } = useToast();

  const form = useForm<DriveFormData>({
    resolver: zodResolver(driveSchema) as any,
    defaultValues: {
      companyId: drive?.companyId || "",
      title: drive?.title || "",
      academicYear: drive?.academicYear || "2024-2025",
      description: drive?.description || "",
      applicationOpenAt: drive?.applicationOpenAt || "",
      applicationCloseAt: drive?.applicationCloseAt || "",
      driveStartDate: drive?.driveStartDate || "",
      driveEndDate: drive?.driveEndDate || "",
      workMode: (drive?.workMode as any) || "ONSITE",
      locations: drive?.locations || [],
      bond: drive?.bond || "",
      selectionProcess: drive?.selectionProcess || "",
      perksAndBenefits: drive?.perksAndBenefits || "",
      pointOfContact: drive?.pointOfContact || "",
      pocEmail: drive?.pocEmail || "",
      pocPhone: drive?.pocPhone || "",
    },
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await fetch("/api/admin/companies?isActive=true");
      if (!response.ok) throw new Error("Failed to fetch companies");
      
      const data = await response.json();
      setCompanies(data.companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast({
        title: "Error",
        description: "Failed to load companies",
        variant: "destructive",
      });
    } finally {
      setCompaniesLoading(false);
    }
  };

  const handleAddLocation = () => {
    if (!locationInput.trim()) return;
    
    const currentLocations = form.getValues("locations");
    if (!currentLocations.includes(locationInput.trim())) {
      form.setValue("locations", [...currentLocations, locationInput.trim()]);
      setLocationInput("");
    }
  };

  const handleRemoveLocation = (locationToRemove: string) => {
    const currentLocations = form.getValues("locations");
    form.setValue("locations", currentLocations.filter(loc => loc !== locationToRemove));
  };

  const onSubmit = async (data: DriveFormData) => {
    try {
      setLoading(true);

      const url = drive 
        ? `/api/admin/drives/${drive.id}`
        : "/api/admin/drives";
      
      const method = drive ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save drive");
      }

      toast({
        title: "Success",
        description: `Drive ${drive ? "updated" : "created"} successfully`,
      });

      onSuccess();
    } catch (error) {
      console.error("Error saving drive:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save drive",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Basic Information</h3>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="companyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company *</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    disabled={companiesLoading || !!drive}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select company" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="academicYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Academic Year *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select academic year" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ACADEMIC_YEARS.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Drive Title *</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="e.g., Software Engineering Internship 2024"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Brief description of the placement drive..."
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Timeline</h3>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="applicationOpenAt"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Application Opens</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(new Date(field.value), "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        {...{
                          mode: "single",
                          selected: field.value ? new Date(field.value) : undefined,
                          onSelect: (date: Date | undefined) => field.onChange(date?.toISOString() || ""),
                          disabled: (date: Date) => date < new Date(),
                          initialFocus: true,
                        } as any}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="applicationCloseAt"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Application Closes</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(new Date(field.value), "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        {...{
                          mode: "single",
                          selected: field.value ? new Date(field.value) : undefined,
                          onSelect: (date: Date | undefined) => field.onChange(date?.toISOString() || ""),
                          disabled: (date: Date) => date < new Date(),
                          initialFocus: true,
                        } as any}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="driveStartDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Drive Starts</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(new Date(field.value), "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        {...{
                          mode: "single",
                          selected: field.value ? new Date(field.value) : undefined,
                          onSelect: (date: Date | undefined) => field.onChange(date?.toISOString() || ""),
                          disabled: (date: Date) => date < new Date(),
                          initialFocus: true,
                        } as any}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="driveEndDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Drive Ends</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(new Date(field.value), "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        {...{
                          mode: "single",
                          selected: field.value ? new Date(field.value) : undefined,
                          onSelect: (date: Date | undefined) => field.onChange(date?.toISOString() || ""),
                          disabled: (date: Date) => date < new Date(),
                          initialFocus: true,
                        } as any}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Work Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Work Details</h3>
          
          <FormField
            control={form.control}
            name="workMode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Work Mode *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select work mode" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {WORK_MODE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="locations"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Locations</FormLabel>
                <FormDescription>
                  Add work locations for this drive
                </FormDescription>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter location..."
                      value={locationInput}
                      onChange={(e) => setLocationInput(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddLocation())}
                    />
                    <Button type="button" variant="outline" onClick={handleAddLocation}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {field.value && field.value.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {field.value.map((location, index) => (
                        <Badge key={index} variant="secondary" className="gap-1">
                          {location}
                          <button
                            type="button"
                            onClick={() => handleRemoveLocation(location)}
                            className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Additional Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Additional Details</h3>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="bond"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bond Details</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Service agreement or bond requirements..."
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="perksAndBenefits"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Perks & Benefits</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Employee benefits, perks, etc..."
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="selectionProcess"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Selection Process</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Describe the selection process, rounds, etc..."
                    rows={4}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Point of Contact */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Point of Contact</h3>
          
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="pointOfContact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Person</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pocEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="email@company.com"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pocPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="tel"
                      placeholder="+1 234 567 8900"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-6">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || companiesLoading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {drive ? "Update Drive" : "Create Drive"}
          </Button>
        </div>
      </form>
    </Form>
  );
}