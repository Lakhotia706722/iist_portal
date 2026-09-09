import { z } from "zod";

export const VIOLATION_TYPES = [
  "ATTENDANCE",
  "MISCONDUCT",
  "DOCUMENT_FRAUD",
  "OFFER_RECIPROCITY",
  "POLICY_VIOLATION",
  "ACADEMIC_INTEGRITY",
  "OTHER",
] as const;

export const INCIDENT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const INCIDENT_STATUSES = ["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"] as const;
export const COMPLIANCE_STATUSES = [
  "ELIGIBLE",
  "CONDITIONAL",
  "RESTRICTED",
  "PLACED",
  "DEBARRED",
] as const;

export const incidentSchema = z.object({
  studentId: z.string().min(1, "Student is required"),
  companyId: z.string().optional().nullable(),
  driveId: z.string().optional().nullable(),
  violationType: z.enum(VIOLATION_TYPES),
  severity: z.enum(INCIDENT_SEVERITIES).default("MEDIUM"),
  description: z.string().min(5).max(4000),
  incidentDate: z.coerce.date(),
  actionTaken: z.string().max(2000).optional().nullable(),
  adminRemarks: z.string().max(2000).optional().nullable(),
  status: z.enum(INCIDENT_STATUSES).default("OPEN"),
});

export const updateIncidentSchema = incidentSchema.partial().omit({ studentId: true });

export const complianceOverrideSchema = z.object({
  status: z.enum(COMPLIANCE_STATUSES),
  reason: z.string().min(10, "A reason of at least 10 characters is required").max(2000),
});

export type IncidentInput = z.infer<typeof incidentSchema>;
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;
export type ComplianceOverrideInput = z.infer<typeof complianceOverrideSchema>;
