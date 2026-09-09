import { z } from "zod";

export const emailTemplateSchema = z.object({
  name: z.string().min(2).max(120),
  subject: z.string().min(2).max(200),
  bodyHtml: z.string().min(10).max(50_000),
  bodyText: z.string().max(20_000).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  variables: z.array(z.string().max(60)).max(40).optional(),
  isActive: z.boolean().optional(),
});

export type EmailTemplateInput = z.infer<typeof emailTemplateSchema>;
