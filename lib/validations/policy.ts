import { z } from "zod";

export const setPolicyRuleSchema = z.object({
  value: z.string().min(1).max(2000),
  batchId: z.string().optional().nullable(),
});

export type SetPolicyRuleInput = z.infer<typeof setPolicyRuleSchema>;
