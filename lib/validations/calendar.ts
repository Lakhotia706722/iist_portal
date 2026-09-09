import { z } from "zod";

export const CALENDAR_EVENT_TYPES = [
  "DRIVE_VISIT",
  "PRE_PLACEMENT_TALK",
  "APTITUDE_TEST",
  "CODING_TEST",
  "TECHNICAL_INTERVIEW",
  "HR_INTERVIEW",
  "SKILLUP_TEST",
  "MOCK_INTERVIEW",
  "DOCUMENT_DEADLINE",
  "APPLICATION_DEADLINE",
  "OTHER",
] as const;

export const calendarEventSchema = z
  .object({
    title: z.string().min(2).max(200),
    type: z.enum(CALENDAR_EVENT_TYPES).default("OTHER"),
    description: z.string().max(2000).optional().nullable(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date().optional().nullable(),
    venue: z.string().max(200).optional().nullable(),
    meetingLink: z.string().url().optional().nullable().or(z.literal("")),
    driveId: z.string().optional().nullable(),
    departmentId: z.string().optional().nullable(),
    batchId: z.string().optional().nullable(),
  })
  .refine((d) => !d.endAt || d.endAt >= d.startAt, {
    message: "End time cannot be before the start time",
    path: ["endAt"],
  });

export const updateCalendarEventSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  type: z.enum(CALENDAR_EVENT_TYPES).optional(),
  description: z.string().max(2000).optional().nullable(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional().nullable(),
  venue: z.string().max(200).optional().nullable(),
  meetingLink: z.string().url().optional().nullable().or(z.literal("")),
  departmentId: z.string().optional().nullable(),
  batchId: z.string().optional().nullable(),
});

export const prePlacementTalkSchema = z.object({
  scheduledAt: z.coerce.date(),
  durationMins: z.number().int().min(5).max(480).optional().nullable(),
  venue: z.string().max(200).optional().nullable(),
  meetingLink: z.string().url().optional().nullable().or(z.literal("")),
  instructions: z.string().max(4000).optional().nullable(),
  faq: z.string().max(8000).optional().nullable(),
});

export type CalendarEventInput = z.infer<typeof calendarEventSchema>;
export type UpdateCalendarEventInput = z.infer<typeof updateCalendarEventSchema>;
export type PrePlacementTalkInput = z.infer<typeof prePlacementTalkSchema>;
