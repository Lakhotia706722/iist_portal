"use client";

/**
 * Pre-placement talk tab - Phase 4
 * Schedule, instructions, FAQ and attachments for a drive's PPT.
 */

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/utils";
import { FileText, Upload, Presentation } from "lucide-react";

type Talk = {
  id: string;
  scheduledAt: string;
  durationMins: number | null;
  venue: string | null;
  meetingLink: string | null;
  instructions: string | null;
  faq: string | null;
  attachmentKeys: string[];
};

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DrivePrePlacementTalk({ driveId }: { driveId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    scheduledAt: "",
    durationMins: "60",
    venue: "",
    meetingLink: "",
    instructions: "",
    faq: "",
  });
  const [file, setFile] = useState<File | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["drive-ppt", driveId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/drives/${driveId}/ppt`);
      if (!res.ok) throw new Error("Failed to load the pre-placement talk");
      return res.json() as Promise<{ talk: Talk | null }>;
    },
  });

  useEffect(() => {
    const t = data?.talk;
    if (t) {
      setForm({
        scheduledAt: toLocalInput(t.scheduledAt),
        durationMins: t.durationMins ? String(t.durationMins) : "",
        venue: t.venue ?? "",
        meetingLink: t.meetingLink ?? "",
        instructions: t.instructions ?? "",
        faq: t.faq ?? "",
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/drives/${driveId}/ppt`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: form.scheduledAt,
          durationMins: form.durationMins ? Number(form.durationMins) : null,
          venue: form.venue || null,
          meetingLink: form.meetingLink || null,
          instructions: form.instructions || null,
          faq: form.faq || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save");
      return body;
    },
    onSuccess: () => {
      toast({ title: "Pre-placement talk saved", variant: "success" });
      qc.invalidateQueries({ queryKey: ["drive-ppt", driveId] });
    },
    onError: (e: Error) =>
      toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const upload = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("file", file!);
      const res = await fetch(`/api/admin/drives/${driveId}/ppt`, { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Upload failed");
      return body;
    },
    onSuccess: () => {
      toast({ title: "Attachment uploaded", variant: "success" });
      setFile(null);
      qc.invalidateQueries({ queryKey: ["drive-ppt", driveId] });
    },
    onError: (e: Error) =>
      toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <LoadingState text="Loading pre-placement talk…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const talk = data?.talk ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Presentation className="h-5 w-5" />
          Pre-placement talk
        </h2>
        <p className="text-sm text-muted-foreground">
          {talk
            ? `Currently scheduled for ${formatDateTime(talk.scheduledAt)}`
            : "Not scheduled yet."}
        </p>
      </div>

      <Card className="space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Date &amp; time" htmlFor="ppt-when" required>
            <Input
              id="ppt-when"
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
            />
          </FormField>
          <FormField label="Duration (minutes)" htmlFor="ppt-dur">
            <Input
              id="ppt-dur"
              type="number"
              min="5"
              value={form.durationMins}
              onChange={(e) => setForm({ ...form, durationMins: e.target.value })}
            />
          </FormField>
          <FormField label="Venue" htmlFor="ppt-venue">
            <Input
              id="ppt-venue"
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
            />
          </FormField>
          <FormField label="Meeting link" htmlFor="ppt-link">
            <Input
              id="ppt-link"
              type="url"
              placeholder="https://…"
              value={form.meetingLink}
              onChange={(e) => setForm({ ...form, meetingLink: e.target.value })}
            />
          </FormField>
        </div>

        <FormField label="Instructions" htmlFor="ppt-instructions">
          <Textarea
            id="ppt-instructions"
            rows={4}
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
            placeholder="Dress code, what to bring, reporting time…"
          />
        </FormField>

        <FormField label="FAQ" htmlFor="ppt-faq" hint="Shown to students alongside the talk.">
          <Textarea
            id="ppt-faq"
            rows={5}
            value={form.faq}
            onChange={(e) => setForm({ ...form, faq: e.target.value })}
          />
        </FormField>

        <div className="flex justify-end">
          <Button disabled={!form.scheduledAt || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save details"}
          </Button>
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="text-base font-semibold">Attachments</h3>
        {talk && talk.attachmentKeys.length > 0 ? (
          <ul className="space-y-2">
            {talk.attachmentKeys.map((key) => (
              <li key={key}>
                <a
                  href={`/api/files/${encodeURIComponent(key)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <FileText className="h-4 w-4" />
                  {key.split("/").pop()}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No presentation or JD attached yet.
          </p>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Add an attachment" htmlFor="ppt-file" className="flex-1">
            <Input
              id="ppt-file"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </FormField>
          <Button
            variant="outline"
            disabled={!file || !talk || upload.isPending}
            onClick={() => upload.mutate()}
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
        </div>
        {!talk && (
          <p className="text-xs text-muted-foreground">
            Save the talk details first, then attach files.
          </p>
        )}
      </Card>
    </div>
  );
}
