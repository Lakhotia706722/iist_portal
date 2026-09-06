"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "PENDING",     label: "Pending Review" },
  { value: "SHORTLISTED", label: "Shortlisted" },
  { value: "REJECTED",    label: "Rejected" },
  { value: "WITHDRAWN",   label: "Withdrawn" },
  { value: "OFFER_MADE",  label: "Offer Made" },
  { value: "ACCEPTED",    label: "Accepted" },
];

interface Filters { search: string; status: string; academicYear: string }

interface Props {
  currentFilters: Filters;
  onFiltersChange: (f: Partial<Filters>) => void;
}

export function ApplicationsFilters({ currentFilters, onFiltersChange }: Props) {
  const hasActive = currentFilters.status || currentFilters.academicYear;

  // Build year options: current year back 4 years
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = currentYear - i;
    return { value: `${y}-${y + 1}`, label: `${y}–${y + 1}` };
  });

  return (
    <div className="border-t pt-4 mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Status</label>
          <Select value={currentFilters.status} onValueChange={v => onFiltersChange({ status: v })}>
            <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All statuses</SelectItem>
              {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Academic Year</label>
          <Select value={currentFilters.academicYear} onValueChange={v => onFiltersChange({ academicYear: v })}>
            <SelectTrigger><SelectValue placeholder="All years" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All years</SelectItem>
              {yearOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <Button variant="outline" className="w-full" disabled={!hasActive}
            onClick={() => onFiltersChange({ status: "", academicYear: "" })}>
            Clear Filters
          </Button>
        </div>
      </div>

      {hasActive && (
        <div className="flex flex-wrap gap-2">
          {currentFilters.status && (
            <Badge variant="secondary" className="gap-1">
              {STATUS_OPTIONS.find(o => o.value === currentFilters.status)?.label}
              <button onClick={() => onFiltersChange({ status: "" })}><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {currentFilters.academicYear && (
            <Badge variant="secondary" className="gap-1">
              AY {currentFilters.academicYear}
              <button onClick={() => onFiltersChange({ academicYear: "" })}><X className="h-3 w-3" /></button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
