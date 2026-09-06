"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect as Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { CheckCircle, XCircle, Video, ExternalLink, Clock } from "lucide-react";
import { formatDate } from "@/lib/utils";

type VideoItem = {
  id: string; status: string; videoUrl: string | null; videoFileUrl: string | null;
  adminNote: string | null; updatedAt: string;
  student: { id: string; enrollmentNumber: string; firstName: string | null; lastName: string | null; user: { email: string } };
};

async function fetchVideos(status: string, page: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: "15", ...(status ? { status } : {}) });
  const res = await fetch(`/api/admin/video-profiles?${params}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json() as Promise<{ items: VideoItem[]; total: number; totalPages: number }>;
}

export function VideoVerificationClient() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("PENDING_VERIFICATION");
  const [page, setPage] = useState(1);
  const [actionTarget, setActionTarget] = useState<{ item: VideoItem; action: "VERIFIED" | "REJECTED" } | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-video-profiles", statusFilter, page],
    queryFn: () => fetchVideos(statusFilter, page),
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ studentId, action, note }: { studentId: string; action: string; note: string }) => {
      const res = await fetch(`/api/admin/video-profiles/${studentId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNote: note }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(JSON.stringify(e.error)); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-video-profiles"] }); setActionTarget(null); setAdminNote(""); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-52">
          <option value="PENDING_VERIFICATION">Pending Verification</option>
          <option value="VERIFIED">Verified</option>
          <option value="REJECTED">Rejected</option>
          <option value="">All</option>
        </Select>
      </div>

      {isLoading ? <LoadingState /> : isError ? <ErrorState onRetry={refetch} /> : (data?.items.length ?? 0) === 0 ? (
        <EmptyState icon={<Video className="h-7 w-7 text-muted-foreground" />} title="No video profiles found" description="No videos match the selected filter." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data!.items.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{item.student.firstName} {item.student.lastName}</p>
                      <p className="text-xs text-muted-foreground">{item.student.enrollmentNumber}</p>
                    </div>
                    <Badge variant={item.status === "VERIFIED" ? "success" : item.status === "REJECTED" ? "destructive" : "warning"}>
                      {item.status === "PENDING_VERIFICATION" ? <Clock className="h-3 w-3 mr-1" /> : item.status === "VERIFIED" ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                      {item.status.replace(/_/g, " ")}
                    </Badge>
                  </div>

                  {/* Video preview / link */}
                  {item.videoFileUrl && (
                    <video src={item.videoFileUrl} controls className="w-full rounded-lg max-h-36 bg-black" />
                  )}
                  {item.videoUrl && !item.videoFileUrl && (
                    <a href={item.videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                      <ExternalLink className="h-4 w-4" />Watch External Video
                    </a>
                  )}

                  {item.adminNote && <p className="text-xs text-destructive">{item.adminNote}</p>}
                  <p className="text-xs text-muted-foreground">Updated {formatDate(new Date(item.updatedAt))}</p>

                  {item.status === "PENDING_VERIFICATION" && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" className="flex-1" onClick={() => { setActionTarget({ item, action: "VERIFIED" }); setAdminNote(""); }}>
                        <CheckCircle className="h-3.5 w-3.5" />Verify
                      </Button>
                      <Button size="sm" variant="destructive" className="flex-1" onClick={() => { setActionTarget({ item, action: "REJECTED" }); setAdminNote(""); }}>
                        <XCircle className="h-3.5 w-3.5" />Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {(data?.totalPages ?? 1) > 1 && (
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="text-sm text-muted-foreground">{page} / {data!.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= data!.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </>
      )}

      <Dialog open={!!actionTarget} onOpenChange={(o) => !o && setActionTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogClose onClose={() => setActionTarget(null)} />
          <DialogHeader>
            <DialogTitle>{actionTarget?.action === "VERIFIED" ? "Verify Video Profile" : "Reject Video Profile"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">{actionTarget?.item.student.firstName} {actionTarget?.item.student.lastName} — {actionTarget?.item.student.enrollmentNumber}</p>
            <FormField label={actionTarget?.action === "VERIFIED" ? "Note (optional)" : "Rejection Reason"} htmlFor="video-note">
              <Textarea id="video-note" rows={3} placeholder={actionTarget?.action === "VERIFIED" ? "Optional note..." : "Explain why the video is rejected (visible to student)..."} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
            </FormField>
            {verifyMutation.error && <p className="text-sm text-destructive">{String(verifyMutation.error)}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setActionTarget(null)}>Cancel</Button>
              <Button
                variant={actionTarget?.action === "VERIFIED" ? "default" : "destructive"}
                loading={verifyMutation.isPending}
                onClick={() => actionTarget && verifyMutation.mutate({ studentId: actionTarget.item.student.id, action: actionTarget.action, note: adminNote })}
              >
                {actionTarget?.action === "VERIFIED" ? "Confirm Verify" : "Confirm Reject"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
