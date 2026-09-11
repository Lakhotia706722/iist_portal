import { z } from "zod";

export const departmentSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  code: z
    .string()
    .min(1, "Code is required")
    .max(20)
    .toUpperCase()
    .regex(/^[A-Z0-9]+$/, "Code must be alphanumeric uppercase"),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
});

export const courseSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  code: z
    .string()
    .min(1, "Code is required")
    .max(20)
    .toUpperCase()
    .regex(/^[A-Z0-9]+$/, "Code must be alphanumeric uppercase"),
  durationYears: z.coerce.number().int().min(1).max(6).default(4),
  isActive: z.boolean().default(true),
});

export const branchSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  code: z
    .string()
    .min(1, "Code is required")
    .max(20)
    .toUpperCase()
    .regex(/^[A-Z0-9]+$/, "Code must be alphanumeric uppercase"),
  departmentId: z.string().min(1, "Department is required"),
  courseId: z.string().min(1, "Course is required"),
  isActive: z.boolean().default(true),
});

export const batchSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  academicYear: z
    .string()
    .regex(/^\d{4}-\d{4}$/, "Format: YYYY-YYYY e.g. 2021-2025"),
  branchId: z.string().min(1, "Branch is required"),
  startYear: z.coerce.number().int().min(2000).max(2100),
  endYear: z.coerce.number().int().min(2000).max(2100),
  isActive: z.boolean().default(true),
});

export type DepartmentInput = z.infer<typeof departmentSchema>;
export type CourseInput = z.infer<typeof courseSchema>;
export type BranchInput = z.infer<typeof branchSchema>;
export type BatchInput = z.infer<typeof batchSchema>;
