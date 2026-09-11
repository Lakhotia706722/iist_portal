"use client";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DOCUMENT_TYPES } from "@/lib/validations/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect as Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Plus, Trash2, Download, FolderOpen, CheckCircle, Clock, XCircle, RefreshCw } from "lucide-react";
import { formatDate } from "@/lib/utils";

const DOC_TYPE_LABELS: Record<string, string> = {
  RESUME: "Resume", PAN_CARD: "PAN Card", COLLEGE_ID: "College ID",
  MARKSHEET_10TH: "10th Marksheet", MARKSHEET_12TH: "12th Marksheet",
  MARKSHEET_DIPLOMA: "Diploma Marksheet", SEMESTER_MARKSHEET: "Semester Marksheet",
  OFFER_LETTER: "Offer Letter", EXPERIENCE_CERTIFICATE: "Experience Certificate",
  CERTIFICATION_CERTIFICATE: "Certification Certificate", NOC: "NOC", OTHER: "Other",
};

const STATUS_CONFIG: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "secondary"; icon: any }> = {
  PENDING:              { label: "Pending",          variant: "warning",     icon: Clock },
  VERIFIED:             { label: "Verified",         variant: "success",     icon: CheckCircle },
  REJECTED:             { label: "Rejected",         variant: "destructive", icon: XCircle },
  RE_UPLOAD_REQUESTED:  { label: "Re-upload Needed", variant: "destructive", icon: RefreshCw },
};

type DocItem = {
  id: string; type: string; name: string; mimeType: string; sizeBytes: number;
  status: string; adminNote: string | null; uploadedAt: string; fileUrl: string;
};

async function fetchDocs() {
  const res = await fetch("/api/student/documents");
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json() as Promise<DocItem[]>;
}

export function DocumentsClient() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocItem | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>("COLLEGE_ID");
  const [docName, setDocName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["student-documents"], queryFn: fetchDocs });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!docFile) throw new Error("No file selected");
      if (!docName.trim()) throw new Error("Document name is required");
      const fd = new FormData();
      fd.append("data", JSON.stringify({ type: docType, name: docName.trim() }));
      fd.append("file", docFile);
      const res = await fetch("/api/student/documents", { method: "POST", body: fd });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Upload failed"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-documents"] }); closeForm(); },
    onError: (e: any) => setUploadError(String(e.message)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/student/documents/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-documents"] }); setDeleteTarget(null); },
  });

  function closeForm() {
    setFormOpen(false); setDocFile(null); setDocName(""); setDocType("COLLEGE_ID"); setUploadError("");
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (isLoading) return <LoadingState text="Loading documents..." />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" />Upload Document</Button>
      </div>

      {(data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-7 w-7 text-muted-foreground" />}
          title="No documents uploaded"
          description="Upload your marksheets, ID proof, certificates and other documents for admin verification."
          action={<Button size="sm" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" />Upload Document</Button>}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.map((doc) => {
                const cfg = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.PENDING;
                const StatusIcon = cfg.icon;
                return (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{doc.name}</p>
                      {doc.adminNote && (
                        <p className="text-xs text-destructive mt-0.5 flex items-center gap-1">
                          <XCircle className="h-3 w-3" />{doc.adminNote}
                        </p>
                      )}
                    </TableCell>
                    <TableCell><span className="text-sm text-muted-foreground">{DOC_TYPE_LABELS[doc.type] ?? doc.type}</span></TableCell>
                    <TableCell>
                      <Badge variant={cfg.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />{cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(new Date(doc.uploadedAt))}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatSize(doc.sizeBytes)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Download"><Download className="h-3.5 w-3.5" /></Button>
                        </a>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(doc)} aria-label="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogClose onClose={closeForm} />
          <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <FormField label="Document Type" required htmlFor="doc-type">
              <Select id="doc-type" value={docType} onChange={(e) => setDocType(e.target.value)}>
                {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{DOC_TYPE_LABELS[t] ?? t}</option>)}
              </Select>
            </FormField>
            <FormField label="Document Name" required htmlFor="doc-name" hint="Descriptive name, e.g. '10th Marksheet 2019'">
              <Input id="doc-name" placeholder="Document name" value={docName} onChange={(e) => setDocName(e.target.value)} />
            </FormField>
            <FormField label="File" required htmlFor="doc-file" hint="PDF, JPEG or PNG — max 10 MB">
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Plus className="h-4 w-4" />{docFile ? docFile.name : "Choose File"}
                </Button>
                {docFile && <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => setDocFile(null)}>Remove</button>}
                <input ref={fileRef} type="file" accept=".pdf,image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => { setDocFile(e.target.files?.[0] ?? null); setUploadError(""); }} />
              </div>
            </FormField>
            {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              <Button onClick={() => uploadMutation.mutate()} loading={uploadMutation.isPending} disabled={!docFile || !docName.trim()}>Upload</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Document" description={`Delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete" onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
