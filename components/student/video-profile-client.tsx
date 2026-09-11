"use client";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { videoProfileSchema, type VideoProfileInput } from "@/lib/validations/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { Video, Upload, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";

type VideoProfile = {
  id?: string; status: string; videoUrl?: string | null; videoFileUrl?: string | null;
  adminNote?: string | null; verifiedAt?: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "secondary"; icon: any }> = {
  NOT_UPLOADED:         { label: "Not Uploaded",         variant: "secondary",    icon: AlertCircle },
  PENDING_VERIFICATION: { label: "Pending Verification", variant: "warning",      icon: Clock },
  VERIFIED:             { label: "Verified",             variant: "success",      icon: CheckCircle },
  REJECTED:             { label: "Rejected",             variant: "destructive",  icon: XCircle },
};

async function fetchVideo() {
  const res = await fetch("/api/student/profile/video");
  if (!res.ok) throw new Error("Failed to fetch video profile");
  return res.json() as Promise<VideoProfile>;
}

export function VideoProfileClient() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<"url" | "file">("url");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["student-video"], queryFn: fetchVideo });

  const form = useForm<VideoProfileInput>({
    resolver: zodResolver(videoProfileSchema) as any,
    defaultValues: { videoUrl: "" },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: VideoProfileInput) => {
      let body: BodyInit; let headers: HeadersInit | undefined;
      if (uploadMode === "file" && videoFile) {
        const fd = new FormData();
        fd.append("data", JSON.stringify({ videoUrl: "" }));
        fd.append("video", videoFile);
        body = fd;
      } else {
        body = JSON.stringify(values);
        headers = { "Content-Type": "application/json" };
      }
      const res = await fetch("/api/student/profile/video", { method: "POST", headers, body });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Upload failed"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["student-video"] }); setFormOpen(false); setVideoFile(null); form.reset(); },
  });

  if (isLoading) return <LoadingState text="Loading video profile..." />;
  if (isError) return <ErrorState onRetry={refetch} />;

  const status = data?.status ?? "NOT_UPLOADED";
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.NOT_UPLOADED;
  const StatusIcon = cfg.icon;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-50">
                <Video className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">Video Introduction</p>
                  <Badge variant={cfg.variant} className="gap-1">
                    <StatusIcon className="h-3 w-3" />{cfg.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  A short 60-second video introduces you to companies before they review your profile.
                </p>
                {data?.adminNote && status === "REJECTED" && (
                  <p className="mt-2 text-sm text-destructive flex items-start gap-1.5">
                    <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    Admin note: {data.adminNote}
                  </p>
                )}
              </div>
            </div>
            <Button size="sm" onClick={() => { form.reset(); setVideoFile(null); setFormOpen(true); }}>
              <Upload className="h-4 w-4" />
              {status === "NOT_UPLOADED" ? "Upload Video" : "Update Video"}
            </Button>
          </div>

          {/* Show embedded video if verified */}
          {status === "VERIFIED" && (data?.videoFileUrl || data?.videoUrl) && (
            <div className="mt-4">
              {data.videoFileUrl ? (
                <video src={data.videoFileUrl} controls className="w-full max-w-lg rounded-lg" />
              ) : (
                <a href={data.videoUrl!} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                  Watch on external platform →
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload/URL form as inline card (not a dialog — file uploads are simpler inline) */}
      {formOpen && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={uploadMode === "url" ? "default" : "outline"} onClick={() => setUploadMode("url")}>Link URL</Button>
              <Button type="button" size="sm" variant={uploadMode === "file" ? "default" : "outline"} onClick={() => setUploadMode("file")}>Upload File</Button>
            </div>

            <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4">
              {uploadMode === "url" ? (
                <FormField label="Video URL" required hint="YouTube, Google Drive, or any direct video link" error={form.formState.errors.videoUrl?.message} htmlFor="video-url">
                  <Input id="video-url" placeholder="https://youtube.com/..." {...form.register("videoUrl")} />
                </FormField>
              ) : (
                <FormField label="Video File" hint="MP4, WebM or MOV — max 100 MB" htmlFor="video-file">
                  <div className="flex items-center gap-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                      <Upload className="h-4 w-4" />{videoFile ? videoFile.name : "Choose File"}
                    </Button>
                    {videoFile && <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => setVideoFile(null)}>Remove</button>}
                    <input ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} />
                  </div>
                </FormField>
              )}

              {saveMutation.error && <p className="text-sm text-destructive">{String(saveMutation.error)}</p>}
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => { setFormOpen(false); setVideoFile(null); form.reset(); }}>Cancel</Button>
                <Button type="submit" size="sm" loading={saveMutation.isPending}>Submit for Review</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
