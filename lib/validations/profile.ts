import { z } from "zod";
import { optionalNumber } from "./common";

// ─── Skill ────────────────────────────────────────────────────────────────────

export const SKILL_CATEGORIES = [
  "PROGRAMMING", "FRAMEWORKS", "DATABASES", "AI_ML", "TOOLS",
  "SOFT_SKILLS", "LANGUAGES", "OTHER",
] as const;

export const SKILL_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;

export const skillCatalogSchema = z.object({
  name: z.string().min(1, "Skill name is required").max(100),
  category: z.enum(SKILL_CATEGORIES).default("OTHER"),
  isActive: z.boolean().default(true),
});

export const studentSkillSchema = z.object({
  skillId: z.string().min(1, "Skill is required"),
  level: z.enum(SKILL_LEVELS).default("BEGINNER"),
  yearsExp: optionalNumber(z.coerce.number().min(0).max(50)),
});

export const customSkillSchema = z.object({
  name: z.string().min(1, "Skill name is required").max(100),
  category: z.enum(SKILL_CATEGORIES).default("OTHER"),
  level: z.enum(SKILL_LEVELS).default("BEGINNER"),
  yearsExp: optionalNumber(z.coerce.number().min(0).max(50)),
});

// ─── Project ──────────────────────────────────────────────────────────────────

export const projectSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required").max(3000),
  techStack: z.array(z.string().min(1).max(50)).min(1, "Add at least one technology"),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  isOngoing: z.boolean().default(false),
  githubUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  liveUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

// ─── Internship / Experience ──────────────────────────────────────────────────

export const internshipSchema = z.object({
  company: z.string().min(1, "Company name is required").max(200),
  role: z.string().min(1, "Role/designation is required").max(200),
  description: z.string().max(3000).optional(),
  location: z.string().max(200).optional(),
  isRemote: z.boolean().default(false),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional().or(z.literal("")),
  isOngoing: z.boolean().default(false),
  stipend: optionalNumber(z.coerce.number().min(0)),
});

// ─── Certification ────────────────────────────────────────────────────────────

export const certificationSchema = z.object({
  name: z.string().min(1, "Certification name is required").max(300),
  issuingOrg: z.string().min(1, "Issuing organization is required").max(200),
  issueDate: z.string().min(1, "Issue date is required"),
  expiryDate: z.string().optional().or(z.literal("")),
  doesNotExpire: z.boolean().default(false),
  credentialId: z.string().max(200).optional().or(z.literal("")),
  credentialUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

// ─── Achievement ──────────────────────────────────────────────────────────────

export const ACHIEVEMENT_TYPES = [
  "HACKATHON", "COMPETITION", "ACADEMIC", "SPORTS",
  "LEADERSHIP", "AWARD", "RESEARCH", "EXTRACURRICULAR",
] as const;

export const achievementSchema = z.object({
  type: z.enum(ACHIEVEMENT_TYPES),
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(3000).optional(),
  date: z.string().optional().or(z.literal("")),
  position: z.string().max(100).optional().or(z.literal("")),
  organizer: z.string().max(200).optional().or(z.literal("")),
});

// ─── Social Profile ───────────────────────────────────────────────────────────

export const SOCIAL_PLATFORMS = [
  "LINKEDIN", "GITHUB", "PORTFOLIO", "LEETCODE",
  "CODECHEF", "HACKERRANK", "KAGGLE", "CODEFORCES", "CUSTOM",
] as const;

export const socialProfileSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  url: z.string().url("Enter a valid URL"),
  username: z.string().max(100).optional().or(z.literal("")),
});

// ─── Video Profile ────────────────────────────────────────────────────────────

export const videoProfileSchema = z.object({
  videoUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

export const videoVerifySchema = z.object({
  action: z.enum(["VERIFIED", "REJECTED"]),
  adminNote: z.string().max(500).optional().or(z.literal("")),
});

// ─── Document ─────────────────────────────────────────────────────────────────

export const DOCUMENT_TYPES = [
  "RESUME", "PAN_CARD", "COLLEGE_ID",
  "MARKSHEET_10TH", "MARKSHEET_12TH", "MARKSHEET_DIPLOMA",
  "SEMESTER_MARKSHEET", "OFFER_LETTER", "EXPERIENCE_CERTIFICATE",
  "CERTIFICATION_CERTIFICATE", "NOC", "OTHER",
] as const;

export const documentUploadSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  name: z.string().min(1, "Document name is required").max(200),
});

/** Phase 16 — P5: confirm step after a direct-to-storage upload — `key`/
 * `mimeType`/`sizeBytes` replace the old multipart file (the client
 * already has all three from the File object it just uploaded). */
export const documentConfirmSchema = documentUploadSchema.extend({
  key: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

export const documentVerifySchema = z.object({
  action: z.enum(["VERIFIED", "REJECTED", "RE_UPLOAD_REQUESTED"]),
  adminNote: z.string().max(500).optional().or(z.literal("")),
});

// ─── Profile Visibility ───────────────────────────────────────────────────────

export const visibilityUpdateSchema = z.object({
  settings: z.array(
    z.object({
      fieldKey: z.string().min(1),
      isVisible: z.boolean(),
    })
  ).min(1),
});

// ─── Resume ───────────────────────────────────────────────────────────────────

export const resumeSchema = z.object({
  name: z.string().min(1, "Resume name is required").max(200),
  isDefault: z.boolean().default(false),
});

export const resumeVersionNoteSchema = z.object({
  notes: z.string().max(500).optional().or(z.literal("")),
});

/** Phase 16 — P5: confirm step after a direct-to-storage upload (see
 * hooks/use-direct-upload.ts) — `key` replaces the old multipart file. */
export const resumeVersionUploadSchema = z.object({
  key: z.string().min(1),
  notes: z.string().max(500).optional().or(z.literal("")),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type SkillCatalogInput = z.infer<typeof skillCatalogSchema>;
export type StudentSkillInput = z.infer<typeof studentSkillSchema>;
export type CustomSkillInput = z.infer<typeof customSkillSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type InternshipInput = z.infer<typeof internshipSchema>;
export type CertificationInput = z.infer<typeof certificationSchema>;
export type AchievementInput = z.infer<typeof achievementSchema>;
export type SocialProfileInput = z.infer<typeof socialProfileSchema>;
export type VideoProfileInput = z.infer<typeof videoProfileSchema>;
export type VideoVerifyInput = z.infer<typeof videoVerifySchema>;
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
export type DocumentVerifyInput = z.infer<typeof documentVerifySchema>;
export type VisibilityUpdateInput = z.infer<typeof visibilityUpdateSchema>;
export type ResumeInput = z.infer<typeof resumeSchema>;
export type ResumeVersionNoteInput = z.infer<typeof resumeVersionNoteSchema>;
