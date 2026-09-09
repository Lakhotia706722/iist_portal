import { z } from "zod";

export const jdInputSchema = z.object({
  jobDescription: z.string().min(20, "Paste the full job description (at least 20 characters)").max(20000),
});

export const draftResumeSchema = z.object({
  targetRole: z.string().min(2).max(150),
  jobDescription: z.string().min(20).max(20000),
});

const bulletSchema = z.object({
  section: z.enum(["summary", "skills", "projects", "experience", "certifications", "achievements"]),
  text: z.string().min(1).max(1000),
  sourceFact: z.string().min(1).max(1000),
});

export const approveDraftSchema = z.object({
  resumeId: z.string().min(1),
  targetRole: z.string().min(2).max(150),
  bullets: z.array(bulletSchema).min(1, "Approve at least one bullet"),
});

export const careerRecommendationSchema = z.object({
  interests: z.string().max(500).optional(),
});

export const interviewPracticeSchema = z.object({
  question: z.string().min(5).max(1000),
  answer: z.string().min(5).max(4000),
});

export type JDInput = z.infer<typeof jdInputSchema>;
export type DraftResumeInput = z.infer<typeof draftResumeSchema>;
export type ApproveDraftInput = z.infer<typeof approveDraftSchema>;
export type InterviewPracticeInput = z.infer<typeof interviewPracticeSchema>;
