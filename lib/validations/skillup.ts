import { z } from "zod";

export const TEST_MODES = ["ONLINE", "OFFLINE", "HYBRID"] as const;
export const TEST_STATUSES = ["DRAFT", "SCHEDULED", "COMPLETED", "CANCELLED"] as const;

export const testTypeSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional().nullable(),
  sortOrder: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

const testBaseSchema = z.object({
  title: z.string().min(3).max(150),
  testTypeId: z.string().min(1, "Test type is required"),
  description: z.string().max(2000).optional().nullable(),
  scheduledAt: z.coerce.date(),
  durationMins: z.number().int().min(1).max(1440).optional().nullable(),
  maxMarks: z.number().positive().max(1000),
  passingMarks: z.number().min(0).max(1000),
  mode: z.enum(TEST_MODES).default("OFFLINE"),
  venue: z.string().max(200).optional().nullable(),
  meetingLink: z.string().url().optional().nullable().or(z.literal("")),
  status: z.enum(TEST_STATUSES).default("SCHEDULED"),
  departmentId: z.string().optional().nullable(),
  batchId: z.string().optional().nullable(),
  /** Explicit eligible-student list; empty means "use department/batch scope". */
  studentIds: z.array(z.string()).optional().default([]),
});

export const testSchema = testBaseSchema.refine(
  (d) => d.passingMarks <= d.maxMarks,
  { message: "Passing marks cannot exceed maximum marks", path: ["passingMarks"] }
);

export const updateTestSchema = testBaseSchema.partial();

export const testResultSchema = z.object({
  studentId: z.string().min(1),
  marksObtained: z.number().min(0),
  remarks: z.string().max(500).optional().nullable(),
});

/** Manual entry / parsed-file upload: rows keyed by enrollment number. */
export const bulkResultSchema = z.object({
  rows: z
    .array(
      z.object({
        enrollmentNumber: z.string().min(1),
        marksObtained: z.coerce.number().min(0),
        remarks: z.string().max(500).optional().nullable(),
      })
    )
    .min(1, "At least one result row is required"),
});

export type TestTypeInput = z.infer<typeof testTypeSchema>;
export type TestInput = z.infer<typeof testSchema>;
export type UpdateTestInput = z.infer<typeof updateTestSchema>;
export type TestResultInput = z.infer<typeof testResultSchema>;
export type BulkResultInput = z.infer<typeof bulkResultSchema>;
