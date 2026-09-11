import { z } from "zod";

export const OFFER_STATUSES = [
  "OFFERED",
  "ACCEPTED",
  "DECLINED",
  "JOINED",
  "WITHDRAWN",
] as const;

export const OFFER_TYPES = [
  "FULL_TIME",
  "INTERNSHIP",
  "INTERNSHIP_WITH_PPO",
  "PPO",
  "CONTRACT",
] as const;

export const OFFER_CATEGORIES = ["CORE", "NON_CORE"] as const;

export const createOfferSchema = z
  .object({
    applicationId: z.string().min(1, "Application is required"),
    category: z.enum(OFFER_CATEGORIES).default("NON_CORE"),
    type: z.enum(OFFER_TYPES).default("FULL_TIME"),
    isPPO: z.boolean().default(false),
    ctc: z.number().nonnegative().max(1000).optional().nullable(),
    stipend: z.number().nonnegative().max(10_000_000).optional().nullable(),
    ctcBreakdown: z.string().max(500).optional().nullable(),
    location: z.string().max(200).optional().nullable(),
    offerDate: z.coerce.date(),
    joiningDate: z.coerce.date().optional().nullable(),
  })
  .refine((d) => d.ctc != null || d.stipend != null, {
    message: "Provide a CTC (full-time) or a stipend (internship)",
    path: ["ctc"],
  })
  .refine((d) => !d.joiningDate || d.joiningDate >= d.offerDate, {
    message: "Joining date cannot be before the offer date",
    path: ["joiningDate"],
  });

export const updateOfferSchema = z.object({
  category: z.enum(OFFER_CATEGORIES).optional(),
  type: z.enum(OFFER_TYPES).optional(),
  isPPO: z.boolean().optional(),
  ctc: z.number().nonnegative().max(1000).optional().nullable(),
  stipend: z.number().nonnegative().max(10_000_000).optional().nullable(),
  ctcBreakdown: z.string().max(500).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  offerDate: z.coerce.date().optional(),
  joiningDate: z.coerce.date().optional().nullable(),
});

export const offerStatusSchema = z.object({
  status: z.enum(OFFER_STATUSES),
  note: z.string().max(500).optional(),
});

export const offerFiltersSchema = z.object({
  status: z.enum(OFFER_STATUSES).optional(),
  companyId: z.string().optional(),
  driveId: z.string().optional(),
  category: z.enum(OFFER_CATEGORIES).optional(),
  academicYear: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(25),
  offset: z.coerce.number().min(0).default(0),
});

export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type UpdateOfferInput = z.infer<typeof updateOfferSchema>;
export type OfferStatusInput = z.infer<typeof offerStatusSchema>;
export type OfferFilters = z.infer<typeof offerFiltersSchema>;
