import { z } from "zod";

// ─── Constants (mirrors Prisma enums) ────────────────────────────────────────

export const INDUSTRY_TYPES = [
  "TECHNOLOGY", "FINANCE", "CONSULTING", "CORE_ENGINEERING",
  "RESEARCH", "DEFENSE", "SPACE", "HEALTHCARE", "EDUCATION",
  "MANUFACTURING", "OTHER",
] as const;

export const WORK_MODES = ["ONSITE", "REMOTE", "HYBRID"] as const;

export const DRIVE_STATUSES = [
  "DRAFT", "PUBLISHED", "APPLICATIONS_OPEN", "APPLICATIONS_CLOSED",
  "ONGOING", "COMPLETED", "CANCELLED",
] as const;

export const APPLICATION_STATUSES = [
  "APPLIED", "UNDER_REVIEW", "SHORTLISTED", "WRITTEN_TEST",
  "TECHNICAL_ROUND", "HR_ROUND", "FINAL_ROUND",
  "SELECTED", "REJECTED", "WITHDRAWN", "ON_HOLD",
] as const;

export const ROUND_TYPES = [
  "WRITTEN_TEST", "APTITUDE_TEST", "CODING_TEST",
  "TECHNICAL_INTERVIEW", "HR_INTERVIEW", "GROUP_DISCUSSION",
  "PRESENTATION", "MEDICAL", "DOCUMENT_VERIFICATION", "OTHER",
] as const;

export const ROUND_MODES = ["ONLINE", "OFFLINE", "HYBRID"] as const;

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;

export const ELIGIBILITY_FIELDS = [
  "CGPA", "ACTIVE_BACKLOGS", "TOTAL_BACKLOGS", "BATCH", "BRANCH",
  "COURSE", "GENDER", "CATEGORY", "PLACEMENT_STATUS", "PROFILE_STATUS",
  "TENTH_PERCENTAGE", "TWELFTH_PERCENTAGE", "CURRENT_SEMESTER",
] as const;

export const ELIGIBILITY_OPERATORS = ["GTE", "LTE", "EQ", "IN", "NOT_IN"] as const;

// ─── Company ─────────────────────────────────────────────────────────────────

export const companySchema = z.object({
  name: z.string().min(1, "Company name is required").max(200),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and hyphens only"),
  industry: z.enum(INDUSTRY_TYPES).default("OTHER"),
  description: z.string().max(5000).optional().or(z.literal("")),
  website: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  location: z.string().max(200).optional().or(z.literal("")),
  headcount: z.string().max(50).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

// ─── Placement Drive ──────────────────────────────────────────────────────────

export const driveSchema = z.object({
  companyId: z.string().min(1, "Company is required"),
  title: z.string().min(1, "Drive title is required").max(300),
  academicYear: z
    .string()
    .regex(/^\d{4}-\d{4}$/, "Format: YYYY-YYYY e.g. 2024-2025"),
  status: z.enum(DRIVE_STATUSES).default("DRAFT"),
  description: z.string().max(10000).optional().or(z.literal("")),
  applicationOpenAt: z.string().optional().or(z.literal("")),
  applicationCloseAt: z.string().optional().or(z.literal("")),
  driveStartDate: z.string().optional().or(z.literal("")),
  driveEndDate: z.string().optional().or(z.literal("")),
  workMode: z.enum(WORK_MODES).default("ONSITE"),
  locations: z.array(z.string().min(1).max(100)).default([]),
  bond: z.string().max(500).optional().or(z.literal("")),
  selectionProcess: z.string().max(5000).optional().or(z.literal("")),
  perksAndBenefits: z.string().max(3000).optional().or(z.literal("")),
  pointOfContact: z.string().max(200).optional().or(z.literal("")),
  pocEmail: z.string().email("Enter a valid email").optional().or(z.literal("")),
  pocPhone: z.string().max(20).optional().or(z.literal("")),
});

// ─── Job Role ─────────────────────────────────────────────────────────────────

export const jobRoleSchema = z.object({
  title: z.string().min(1, "Role title is required").max(200),
  description: z.string().max(5000).optional().or(z.literal("")),
  responsibilities: z.string().max(5000).optional().or(z.literal("")),
  requirements: z.string().max(3000).optional().or(z.literal("")),
  ctcMin: z.coerce.number().min(0).optional(),
  ctcMax: z.coerce.number().min(0).optional(),
  ctcBreakdown: z.string().max(500).optional().or(z.literal("")),
  openings: z.coerce.number().int().min(1).optional(),
  skills: z.array(z.string().min(1).max(100)).default([]),
  workMode: z.enum(WORK_MODES).default("ONSITE"),
  locations: z.array(z.string().min(1).max(100)).default([]),
  isActive: z.boolean().default(true),
});

// ─── Eligibility Rule ─────────────────────────────────────────────────────────

export const eligibilityRuleSchema = z.object({
  field: z.enum(ELIGIBILITY_FIELDS),
  operator: z.enum(ELIGIBILITY_OPERATORS),
  value: z.string().min(1, "Value is required").max(500),
  label: z.string().min(1, "Label is required").max(200),
  isActive: z.boolean().default(true),
});

export const eligibilityRulesBulkSchema = z.object({
  rules: z.array(eligibilityRuleSchema),
});

// ─── Application ──────────────────────────────────────────────────────────────

export const applySchema = z.object({
  jobRoleId: z.string().min(1, "Job role is required"),
  resumeVersionId: z.string().optional().or(z.literal("")),
  confirmed: z.literal(true).refine((val) => val === true, {
    message: "You must confirm to apply"
  }),
});

export const applicationStatusSchema = z.object({
  status: z.enum(APPLICATION_STATUSES),
  note: z.string().max(500).optional().or(z.literal("")),
});

export const withdrawSchema = z.object({
  reason: z.string().max(500).optional().or(z.literal("")),
});

// ─── Round ────────────────────────────────────────────────────────────────────

export const roundSchema = z.object({
  roundNumber: z.coerce.number().int().min(1),
  title: z.string().min(1, "Round title is required").max(200),
  type: z.enum(ROUND_TYPES).default("OTHER"),
  mode: z.enum(ROUND_MODES).default("OFFLINE"),
  scheduledAt: z.string().optional().or(z.literal("")),
  durationMins: z.coerce.number().int().min(1).optional(),
  venue: z.string().max(300).optional().or(z.literal("")),
  meetingLink: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  instructions: z.string().max(3000).optional().or(z.literal("")),
});

// ─── Round Participant result ─────────────────────────────────────────────────

export const participantResultSchema = z.object({
  result: z.enum(["PASS", "FAIL", "PENDING", "HOLD"]).optional().or(z.literal("")),
  remarks: z.string().max(1000).optional().or(z.literal("")),
  nextAction: z.string().max(500).optional().or(z.literal("")),
});

// ─── Attendance ───────────────────────────────────────────────────────────────

export const attendanceSchema = z.object({
  status: z.enum(ATTENDANCE_STATUSES),
  note: z.string().max(500).optional().or(z.literal("")),
});

export const bulkAttendanceSchema = z.object({
  records: z.array(
    z.object({
      roundParticipantId: z.string().min(1),
      status: z.enum(ATTENDANCE_STATUSES),
      note: z.string().max(500).optional().or(z.literal("")),
    })
  ).min(1),
});

// ─── Shortlist ────────────────────────────────────────────────────────────────

export const bulkShortlistSchema = z.object({
  applicationIds: z.array(z.string().min(1)).min(1),
  action: z.enum(["SHORTLISTED", "REJECTED"]),
  note: z.string().max(500).optional().or(z.literal("")),
});

export const csvShortlistSchema = z.object({
  // enrollment numbers from CSV, mapped to applications
  enrollmentNumbers: z.array(z.string().min(1)).min(1),
  jobRoleId: z.string().min(1),
  note: z.string().max(500).optional().or(z.literal("")),
});

// ─── Drive status change ──────────────────────────────────────────────────────

export const driveStatusSchema = z.object({
  status: z.enum(DRIVE_STATUSES),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type CompanyInput            = z.infer<typeof companySchema>;
export type DriveInput              = z.infer<typeof driveSchema>;
export type JobRoleInput            = z.infer<typeof jobRoleSchema>;
export type EligibilityRuleInput    = z.infer<typeof eligibilityRuleSchema>;
export type EligibilityRulesBulk    = z.infer<typeof eligibilityRulesBulkSchema>;
export type ApplyInput              = z.infer<typeof applySchema>;
export type ApplicationStatusInput  = z.infer<typeof applicationStatusSchema>;
export type WithdrawInput           = z.infer<typeof withdrawSchema>;
export type RoundInput              = z.infer<typeof roundSchema>;
export type ParticipantResultInput  = z.infer<typeof participantResultSchema>;
export type AttendanceInput         = z.infer<typeof attendanceSchema>;
export type BulkAttendanceInput     = z.infer<typeof bulkAttendanceSchema>;
export type BulkShortlistInput      = z.infer<typeof bulkShortlistSchema>;
export type CsvShortlistInput       = z.infer<typeof csvShortlistSchema>;
export type DriveStatusInput        = z.infer<typeof driveStatusSchema>;
