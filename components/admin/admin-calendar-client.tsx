"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect as Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CalendarView } from "@/components/shared/calendar-view";
import { formatStatusLabel } from "@/components/shared/status-badge";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { CALENDAR_EVENT_TYPES } from "@/lib/validations/calendar";

const EMPTY = {
  title: "",
  type: "OTHER",
  description: "",
  startAt: "",
  endAt: "",
  venue: "",
  meetingLink: "",
  batchId: "",
};

export function AdminCalendarClient() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          type: form.type,
          description: form.description || null,
          startAt: form.startAt,
          endAt: form.endAt || null,
          venue: form.venue || null,
          meetingLink: form.meetingLink || null,
          batchId: form.batchId || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(
          body.error ?? Object.values(body.fieldErrors ?? {})[0] ?? "Could not create event"
        );
      }
      return body;
    },
    onSuccess: () => {
      toast({ title: "Event created", variant: "success" });
      setOpen(false);
      setForm(EMPTY);
      setFormError(null);
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (e: Error) => {
      setFormError(e.message);
      toast({ title: "Could not create event", description: e.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <Button
        onClick={() => {
          setForm(EMPTY);
          setFormError(null);
          setOpen(true);
        }}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add event
      </Button>

      <CalendarView
        endpoint="/api/admin/calendar"
        emptyDescription="Rounds, tests, interviews and deadlines appear here automatically. Add standalone events with the button above."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Add calendar event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FormField label="Title" htmlFor="ev-title" required>
              <Input
                id="ev-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Type" htmlFor="ev-type">
                <Select
                  id="ev-type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {CALENDAR_EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {formatStatusLabel(t)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Venue" htmlFor="ev-venue">
                <Input
                  id="ev-venue"
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                />
              </FormField>
              <FormField label="Starts" htmlFor="ev-start" required>
                <Input
                  id="ev-start"
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                />
              </FormField>
              <FormField label="Ends" htmlFor="ev-end">
                <Input
                  id="ev-end"
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                />
              </FormField>
            </div>

            <FormField label="Meeting link" htmlFor="ev-link">
              <Input
                id="ev-link"
                type="url"
                placeholder="https://…"
                value={form.meetingLink}
                onChange={(e) => setForm({ ...form, meetingLink: e.target.value })}
              />
            </FormField>

            <FormField label="Description" htmlFor="ev-desc">
              <Textarea
                id="ev-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </FormField>

            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!form.title || !form.startAt || create.isPending}
              onClick={() => {
                setFormError(null);
                create.mutate();
              }}
            >
              {create.isPending ? "Saving…" : "Add event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
