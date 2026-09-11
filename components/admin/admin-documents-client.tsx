"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect as Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Search, Download, CheckCircle, XCircle, RefreshCw, FolderOpen, Clock } from "lucide-react";
import { formatDate } from "@/lib/utils";

const STATUS_VARIANTS: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  VERIFIED: "success", PENDING: "warning", REJECTED: "destructive", RE_UPLOAD_REQUESTED: "destructive",
};
const STATUS_LABELS: Record<string, string> = {
  VERIFIED: "Verified", PENDING: "Pending", REJECTED: "Rejected", RE_UPLOAD_REQUESTED: "Re-upload",
};
const DOC_TYPE_LABELS: Record<string, string> = {
  RESUME: "Resume", PAN_CARD: "PAN Card", COLLEGE_ID: "College ID",
  MARKSHEET_10TH: "10th Marksheet", MARKSHEET_12TH: "12th Marksheet",
  MARKSHEET_DIPLOMA: "Diploma", SEMESTER_MARKSHEET: "Semester Marksheet",
  OFFER_LETTER: "Offer Letter", EXPERIENCE_CERTIFICATE: "Exp. Certificate",
  CERTIFICATION_CERTIFICATE: "Cert. Certificate", NOC: "NOC", OTHER: "Other",
};

type DocItem = {
  id: string; type: string; name: string; sizeBytes: number; status: string;
  adminNote: string | null; uploadedAt: string; fileUrl: string;
  student: { id: string; enrollmentNumber: string; firstName: string | null; lastName: string | null };
};

async function fetchDocs(opts: { search?: string; status?: string; type?: string; page: number }) {
  const params = new URLSearchParams({
    page: String(opts.page), pageSize: "20",
    ...(opts.search ? { search: opts.search } : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.type ? { type: opts.type } : {}),
  });
  const res = await fetch(`/api/admin/documents?${params}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json() as Promise<{ items: DocItem[]; total: number; totalPages: number }>;
}

export function AdminDocumentsClient() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [actionTarget, setActionTarget] = useState<{ doc: DocItem; action: string } | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-documents", search, statusFilter, typeFilter, page],
    queryFn: () => fetchDocs({ search, status: statusFilter || undefined, type: typeFilter || undefined, page }),
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ id, action, note }: { id: string; action: string; note: string }) => {
      const res = await fetch(`/api/admin/documents/${id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNote: note }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(JSON.stringify(e.error)); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-documents"] }); setActionTarget(null); setAdminNote(""); },
  });

  function openAction(doc: DocItem, action: string) { setActionTarget({ doc, action }); setAdminNote(""); }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search student or document..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select 
          value={statusFilter} 
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} 
          className="flex h-10 w-40 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="">All Statuses</option>
          {["PENDING", "VERIFIED", "REJECTED", "RE_UPLOAD_REQUESTED"].map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select 
          value={typeFilter} 
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} 
          className="flex h-10 w-44 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="">All Types</option>
          {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <Card>
        {isLoading ? <LoadingState /> : isError ? <ErrorState onRetry={refetch} /> : (data?.items.length ?? 0) === 0 ? (
          <EmptyState icon={<FolderOpen className="h-7 w-7 text-muted-foreground" />} title="No documents found" className="border-none" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-36">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.items.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{doc.student.firstName} {doc.student.lastName}</p>
                      <p className="text-xs text-muted-foreground">{doc.student.enrollmentNumber}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{doc.name}</p>
                      {doc.adminNote && <p className="text-xs text-destructive mt-0.5">{doc.adminNote}</p>}
                    </TableCell>
                    <TableCell><span className="text-xs text-muted-foreground">{DOC_TYPE_LABELS[doc.type] ?? doc.type}</span></TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[doc.status] ?? "secondary"}>
                        {STATUS_LABELS[doc.status] ?? doc.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(new Date(doc.uploadedAt))}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="View"><Download className="h-3.5 w-3.5" /></Button>
                        </a>
                        {doc.status !== "VERIFIED" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700" onClick={() => openAction(doc, "VERIFIED")} aria-label="Verify"><CheckCircle className="h-3.5 w-3.5" /></Button>
                        )}
                        {doc.status !== "REJECTED" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => openAction(doc, "REJECTED")} aria-label="Reject"><XCircle className="h-3.5 w-3.5" /></Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700" onClick={() => openAction(doc, "RE_UPLOAD_REQUESTED")} aria-label="Request re-upload"><RefreshCw className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {(data?.totalPages ?? 1) > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">Total: {data!.total}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <span className="flex items-center text-sm text-muted-foreground px-2">{page} / {data!.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= data!.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <Dialog open={!!actionTarget} onOpenChange={(o) => !o && setActionTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogClose onClose={() => setActionTarget(null)} />
          <DialogHeader>
            <DialogTitle>
              {actionTarget?.action === "VERIFIED" ? "Verify Document" : actionTarget?.action === "REJECTED" ? "Reject Document" : "Request Re-upload"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">{actionTarget?.doc.name} — {actionTarget?.doc.student.firstName} {actionTarget?.doc.student.lastName}</p>
            <FormField label={actionTarget?.action === "VERIFIED" ? "Note (optional)" : "Reason (required)"} htmlFor="admin-note">
              <Textarea id="admin-note" rows={3} placeholder={actionTarget?.action === "VERIFIED" ? "Optional verification note..." : "Explain why document is rejected or needs re-upload..."} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
            </FormField>
            {verifyMutation.error && <p className="text-sm text-destructive">{String(verifyMutation.error)}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setActionTarget(null)}>Cancel</Button>
              <Button
                variant={actionTarget?.action === "VERIFIED" ? "default" : "destructive"}
                loading={verifyMutation.isPending}
                onClick={() => actionTarget && verifyMutation.mutate({ id: actionTarget.doc.id, action: actionTarget.action, note: adminNote })}
              >
                {actionTarget?.action === "VERIFIED" ? "Verify" : actionTarget?.action === "REJECTED" ? "Reject" : "Request Re-upload"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
