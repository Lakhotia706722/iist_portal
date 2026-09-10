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

// ─── Users & Roles (Phase 12) ──────────────────────────────────────────────
// Staff accounts only (TP_ADMIN / FACULTY / HOD / COMPANY_REP) — STUDENT
// accounts are created through registration/onboarding, a separate flow
// with far more required fields (enrollment number, branch, batch...) that
// this admin screen isn't taking over.

export const STAFF_ROLES = ["TP_ADMIN", "FACULTY", "HOD", "COMPANY_REP"] as const;

export const createUserSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(200),
    email: z.string().email("Enter a valid email"),
    role: z.enum(STAFF_ROLES),
    // Role-specific profile fields — required only for the roles that need
    // them; refined below since a bare z.string().optional() would accept
    // an empty string for e.g. a HOD's required department.
    employeeId: z.string().max(50).optional(),
    designation: z.string().max(200).optional(),
    departmentId: z.string().optional(),
    companyId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.role === "FACULTY" || data.role === "HOD") && !data.employeeId) {
      ctx.addIssue({ code: "custom", path: ["employeeId"], message: "Employee ID is required" });
    }
    if ((data.role === "FACULTY" || data.role === "HOD") && !data.departmentId) {
      ctx.addIssue({ code: "custom", path: ["departmentId"], message: "Department is required" });
    }
    if (data.role === "FACULTY" && !data.designation) {
      ctx.addIssue({ code: "custom", path: ["designation"], message: "Designation is required" });
    }
  });

export const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
