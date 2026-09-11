/**
 * Job Role Form Component — Phase 9
 *
 * Was a stub ("Job role form will be implemented here...") — found by
 * Phase 9's real-browser verification, since the "Add Job Role" button and
 * dialog rendered fine and passed every prior tsc/build/API-level check.
 * This is the real create/edit form, matching DriveForm's conventions.
 */

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { jobRoleSchema } from "@/lib/validations/placement";
import type { z } from "zod";

type JobRoleFormData = z.infer<typeof jobRoleSchema>;

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
}

interface JobRoleFormProps {
  driveId: string;
  role?: JobRole;
  onSuccess: () => void;
  onCancel: () => void;
}

const WORK_MODE_OPTIONS = [
  { value: "ONSITE", label: "On-site" },
  { value: "REMOTE", label: "Remote" },
  { value: "HYBRID", label: "Hybrid" },
];

export function JobRoleForm({ driveId, role, onSuccess, onCancel }: JobRoleFormProps) {
  const [loading, setLoading] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const { toast } = useToast();

  const form = useForm<JobRoleFormData>({
    resolver: zodResolver(jobRoleSchema) as any,
    defaultValues: {
      title: role?.title || "",
      description: role?.description || "",
      ctcMin: role?.ctcMin ?? undefined,
      ctcMax: role?.ctcMax ?? undefined,
      openings: role?.openings ?? undefined,
      skills: role?.skills || [],
      workMode: (role?.workMode as any) || "ONSITE",
      locations: role?.locations || [],
      isActive: role?.isActive ?? true,
    },
  });

  const handleAddSkill = () => {
    if (!skillInput.trim()) return;
    const current = form.getValues("skills");
    if (!current.includes(skillInput.trim())) {
      form.setValue("skills", [...current, skillInput.trim()]);
      setSkillInput("");
    }
  };
  const handleRemoveSkill = (skill: string) => {
    form.setValue("skills", form.getValues("skills").filter((s) => s !== skill));
  };

  const handleAddLocation = () => {
    if (!locationInput.trim()) return;
    const current = form.getValues("locations");
    if (!current.includes(locationInput.trim())) {
      form.setValue("locations", [...current, locationInput.trim()]);
      setLocationInput("");
    }
  };
  const handleRemoveLocation = (loc: string) => {
    form.setValue("locations", form.getValues("locations").filter((l) => l !== loc));
  };

  const onSubmit = async (data: JobRoleFormData) => {
    try {
      setLoading(true);

      const url = role
        ? `/api/admin/drives/${driveId}/roles/${role.id}`
        : `/api/admin/drives/${driveId}/roles`;
      const method = role ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save job role");
      }

      toast({ title: "Success", description: `Job role ${role ? "updated" : "created"} successfully` });
      onSuccess();
    } catch (error) {
      console.error("Error saving job role:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save job role",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role Title *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. Software Development Engineer" />
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
                <Textarea {...field} placeholder="Role summary…" rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="ctcMin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CTC Min (LPA)</FormLabel>
                <FormControl>
                  <Input {...field} type="number" step="0.1" value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ctcMax"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CTC Max (LPA)</FormLabel>
                <FormControl>
                  <Input {...field} type="number" step="0.1" value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="openings"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Openings</FormLabel>
                <FormControl>
                  <Input {...field} type="number" min="1" value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="workMode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Work Mode *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {WORK_MODE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="skills"
          render={() => (
            <FormItem>
              <FormLabel>Required Skills</FormLabel>
              <div className="flex gap-2">
                <Input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddSkill(); } }}
                  placeholder="e.g. React"
                />
                <Button type="button" variant="outline" onClick={handleAddSkill}><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {form.watch("skills").map((skill) => (
                  <Badge key={skill} variant="outline" className="gap-1">
                    {skill}
                    <button type="button" onClick={() => handleRemoveSkill(skill)}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="locations"
          render={() => (
            <FormItem>
              <FormLabel>Locations</FormLabel>
              <div className="flex gap-2">
                <Input
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddLocation(); } }}
                  placeholder="e.g. Bengaluru"
                />
                <Button type="button" variant="outline" onClick={handleAddLocation}><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {form.watch("locations").map((loc) => (
                  <Badge key={loc} variant="secondary" className="gap-1">
                    {loc}
                    <button type="button" onClick={() => handleRemoveLocation(loc)}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {role ? "Update Role" : "Create Role"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
