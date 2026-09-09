import { z } from "zod";

export const INTERVIEW_TYPES = [
  "TECHNICAL",
  "HR",
  "MANAGERIAL",
  "CASE_STUDY",
  "GROUP_DISCUSSION",
  "STRESS",
  "MIXED",
] as const;

export const INTERVIEW_MODES = ["ONLINE", "OFFLINE"] as const;
export const INTERVIEW_STATUSES = [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

const score = z.number().min(0).max(10);

export const mockInterviewSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  interviewerName: z.string().min(2).max(120),
  interviewerId: z.string().optional().nullable(),
  scheduledAt: z.coerce.date(),
  durationMins: z.number().int().min(5).max(480).optional().nullable(),
  targetRole: z.string().max(150).optional().nullable(),
  type: z.enum(INTERVIEW_TYPES).default("MIXED"),
  mode: z.enum(INTERVIEW_MODES).default("OFFLINE"),
  venue: z.string().max(200).optional().nullable(),
  meetingLink: z.string().url().optional().nullable().or(z.literal("")),
  status: z.enum(INTERVIEW_STATUSES).default("SCHEDULED"),
});

export const updateMockInterviewSchema = mockInterviewSchema.partial().omit({
  studentId: true,
});

export const interviewResultSchema = z.object({
  technicalScore: score.optional().nullable(),
  communicationScore: score.optional().nullable(),
  confidenceScore: score.optional().nullable(),
  problemSolvingScore: score.optional().nullable(),
  hrScore: score.optional().nullable(),
  /** Left blank, this is averaged from the per-skill scores provided. */
  overallScore: score.optional().nullable(),
  feedback: z.string().max(4000).optional().nullable(),
  strengths: z.array(z.string().max(200)).max(20).default([]),
  weaknesses: z.array(z.string().max(200)).max(20).default([]),
  improvementSuggestions: z.array(z.string().max(300)).max(20).default([]),
});

export type MockInterviewInput = z.infer<typeof mockInterviewSchema>;
export type UpdateMockInterviewInput = z.infer<typeof updateMockInterviewSchema>;
export type InterviewResultInput = z.infer<typeof interviewResultSchema>;
