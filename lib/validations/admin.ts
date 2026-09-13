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
// accounts are provisioned through the dedicated admin student-creation
// flow instead (createStudentSchema / bulkCreateStudentsSchema below,
// Phase 17 P4), which collects the extra required fields (enrollment
// number, branch, batch) this screen doesn't ask for.

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

// ─── Student provisioning (Phase 17 P4) ────────────────────────────────────
// Admin-created student accounts: no password is generated/emailed — the
// account is created with mustChangePassword:true and the student receives
// a "set your password" email via the same PasswordResetToken mechanism
// forgot-password already uses (see lib/auth/password-reset.ts).

export const createStudentSchema = z.object({
  name: z.string().min(1, "Full name is required").max(200),
  email: z.string().email("Enter a valid college email"),
  enrollmentNumber: z.string().min(1, "Enrollment number is required").max(50),
  branchId: z.string().min(1, "Branch is required"),
  batchId: z.string().min(1, "Batch is required"),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;

// One CSV row — resolved against Branch.code and Batch.academicYear (scoped
// to that branch) rather than internal ids, since that's what a CSV author
// can reasonably supply.
export const studentCsvRowSchema = z.object({
  enrollmentNumber: z.string().min(1, "Enrollment number is required").max(50),
  name: z.string().min(1, "Full name is required").max(200),
  email: z.string().email("Enter a valid college email"),
  branchCode: z.string().min(1, "Branch code is required").max(20),
  batchAcademicYear: z
    .string()
    .regex(/^\d{4}-\d{4}$/, "Batch academic year must be formatted YYYY-YYYY"),
});

export const bulkCreateStudentsSchema = z.object({
  rows: z.array(studentCsvRowSchema).min(1, "At least one row is required").max(1000),
});

export type StudentCsvRowInput = z.infer<typeof studentCsvRowSchema>;
export type BulkCreateStudentsInput = z.infer<typeof bulkCreateStudentsSchema>;
