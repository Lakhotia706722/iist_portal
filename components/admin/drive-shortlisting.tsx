"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { useToast } from "@/hooks/use-toast";
import {
  UserCheck, Filter, Upload, Search, CheckSquare, Square,
  ChevronUp, ChevronDown, RefreshCw, Download, X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Applicant {
  id: string;
  status: string;
  appliedAt: string;
  adminNote: string | null;
  student: {
    id: string;
    enrollmentNumber: string;
    user: { name: string; email: string };
    branch: { name: string; code: string };
    batch: { academicYear: string };
    academicRecord: { currentCgpa: number | null } | null;
  };
  jobRole: { id: string; title: string };
  resumeVersion: { filename: string; fileUrl: string } | null;
}

interface Props { driveId: string }

const STATUS_OPTIONS = [
  { value: "PENDING",     label: "Pending" },
  { value: "SHORTLISTED", label: "Shortlisted" },
  { value: "REJECTED",    label: "Rejected" },
];

export function DriveShortlisting({ driveId }: Props) {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sortField, setSortField] = useState<"appliedAt" | "cgpa">("appliedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [bulkAction, setBulkAction] = useState("");
  const [bulkNote, setBulkNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [csvUploading, setCsvUploading] = useState(false);
  const [showCsvPanel, setShowCsvPanel] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchApplicants = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const p = new URLSearchParams({ limit: "100" });
      if (statusFilter) p.set("status", statusFilter);
      if (search) p.set("search", search);
      const res = await fetch(`/api/admin/drives/${driveId}/shortlist?${p}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setApplicants(data.applications ?? []);
      setTotal(data.total ?? data.applications?.length ?? 0);
    } catch {
      toast({ title: "Error", description: "Failed to load applicants.", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // Intentionally excludes `search`: search is applied client-side to the
    // fetched page (see `displayed` below), so re-fetching per keystroke
    // would be wasteful — only the status filter triggers a re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driveId, statusFilter, toast]);

  useEffect(() => { fetchApplicants(); }, [fetchApplicants]);

  /* ── filtering / sorting (client-side) ── */
  const displayed = applicants
    .filter(a => {
      if (roleFilter && a.jobRole.id !== roleFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          a.student.user.name.toLowerCase().includes(q) ||
          a.student.enrollmentNumber.toLowerCase().includes(q) ||
          a.jobRole.title.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let va: number, vb: number;
      if (sortField === "cgpa") {
        va = a.student.academicRecord?.currentCgpa ?? 0;
        vb = b.student.academicRecord?.currentCgpa ?? 0;
      } else {
        va = new Date(a.appliedAt).getTime();
        vb = new Date(b.appliedAt).getTime();
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });

  const allSelected = displayed.length > 0 && displayed.every(a => selected.has(a.id));
  const toggle = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll = () =>
    allSelected ? setSelected(new Set()) : setSelected(new Set(displayed.map(a => a.id)));

  const sortBy = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  /* ── bulk action ── */
  const applyBulk = async () => {
    if (!bulkAction || selected.size === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/drives/${driveId}/shortlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationIds: [...selected],
          action: bulkAction,
          note: bulkNote || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Done", description: `${selected.size} application(s) updated.` });
      setSelected(new Set());
      setBulkAction("");
      setBulkNote("");
      await fetchApplicants(true);
    } catch {
      toast({ title: "Error", description: "Bulk action failed.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  /* ── CSV upload ── */
  const uploadCsv = async (file: File) => {
    setCsvUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/admin/drives/${driveId}/shortlist?action=csv`, {
        method: "POST", body: form,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast({ title: "CSV Processed", description: `${data.processed ?? "?"} records updated.` });
      setShowCsvPanel(false);
      await fetchApplicants(true);
    } catch {
      toast({ title: "Error", description: "CSV upload failed.", variant: "destructive" });
    } finally {
      setCsvUploading(false);
    }
  };

  /* ── unique roles ── */
  const roles = Array.from(new Map(applicants.map(a => [a.jobRole.id, a.jobRole.title])).entries());

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Shortlisting</h2>
          <p className="text-sm text-muted-foreground">{total} applicants total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchApplicants(true)} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4 mr-1.5", refreshing && "animate-spin")} />Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowCsvPanel(v => !v)}>
            <Upload className="h-4 w-4 mr-1.5" />CSV Upload
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/admin/drives/${driveId}/shortlist?action=export`} download>
              <Download className="h-4 w-4 mr-1.5" />Export
            </a>
          </Button>
        </div>
      </div>

      {/* CSV panel */}
      {showCsvPanel && (
        <Card className="border-dashed">
          <CardContent className="p-4 flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground text-center">
              Upload a CSV with columns <code>enrollmentNumber</code>, <code>action</code> (shortlist/reject), optional <code>note</code>.
            </p>
            <input ref={csvRef} type="file" accept=".csv" className="hidden"
              onChange={e => { if (e.target.files?.[0]) uploadCsv(e.target.files[0]); }} />
            <Button size="sm" onClick={() => csvRef.current?.click()} disabled={csvUploading}>
              {csvUploading ? <LoadingSpinner size="sm" className="mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {csvUploading ? "Uploading…" : "Choose CSV"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters row */}
      <Card className="p-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search name or enrollment…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All statuses</SelectItem>
              {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {roles.length > 1 && (
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All roles" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All roles</SelectItem>
                {roles.map(([id, title]) => <SelectItem key={id} value={id}>{title}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {(search || statusFilter || roleFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter(""); setRoleFilter(""); }}>
              <X className="h-4 w-4 mr-1" />Clear
            </Button>
          )}
        </div>
      </Card>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-blue-800">{selected.size} selected</span>
            <Select value={bulkAction} onValueChange={setBulkAction}>
              <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="Choose action…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="shortlist">Shortlist</SelectItem>
                <SelectItem value="reject">Reject</SelectItem>
              </SelectContent>
            </Select>
            <Input className="flex-1 min-w-[180px] bg-white" placeholder="Optional note…"
              value={bulkNote} onChange={e => setBulkNote(e.target.value)} />
            <Button size="sm" onClick={applyBulk} disabled={!bulkAction || submitting}>
              {submitting ? <LoadingSpinner size="sm" className="mr-2" /> : null}Apply
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {displayed.length === 0 ? (
        <EmptyState icon="users" title="No applicants found" description="Try adjusting your filters." />
      ) : (
        <div className="rounded-md border overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="p-3 w-10">
                  <button onClick={toggleAll}>
                    {allSelected ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </th>
                <th className="p-3 text-left font-medium">Student</th>
                <th className="p-3 text-left font-medium">Role</th>
                <th className="p-3 text-left font-medium cursor-pointer select-none"
                  onClick={() => sortBy("cgpa")}>
                  <span className="flex items-center gap-1">
                    CGPA {sortField === "cgpa" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
                  </span>
                </th>
                <th className="p-3 text-left font-medium cursor-pointer select-none"
                  onClick={() => sortBy("appliedAt")}>
                  <span className="flex items-center gap-1">
                    Applied {sortField === "appliedAt" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
                  </span>
                </th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="p-3 text-left font-medium">Resume</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((a, i) => (
                <tr key={a.id} className={cn("border-b hover:bg-muted/20 transition-colors", i % 2 === 0 && "bg-background")}>
                  <td className="p-3">
                    <button onClick={() => toggle(a.id)}>
                      {selected.has(a.id)
                        ? <CheckSquare className="h-4 w-4 text-primary" />
                        : <Square className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  </td>
                  <td className="p-3">
                    <p className="font-medium">{a.student.user.name}</p>
                    <p className="text-xs text-muted-foreground">{a.student.enrollmentNumber} · {a.student.branch.code} · {a.student.batch.academicYear}</p>
                  </td>
                  <td className="p-3 text-muted-foreground">{a.jobRole.title}</td>
                  <td className="p-3 font-mono">{a.student.academicRecord?.currentCgpa?.toFixed(2) ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(a.appliedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={a.status} className="text-xs" />
                  </td>
                  <td className="p-3">
                    {a.resumeVersion ? (
                      <a href={a.resumeVersion.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary underline underline-offset-2 hover:no-underline">
                        View
                      </a>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
