import { NextRequest } from "next/server";
import { handlers } from "@/lib/auth/auth";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

export const { GET } = handlers;

/**
 * Rate limit sign-in attempts (this catch-all also handles
 * /api/auth/callback/credentials — the actual login POST). 10 attempts per
 * minute per IP is enough for a real user typo-ing a password without
 * meaningfully slowing a credential-stuffing attempt.
 */
export async function POST(request: NextRequest) {
  const result = await checkRateLimit(request, { bucket: "auth", limit: 10, windowMs: 60_000 });
  if (!result.allowed) return rateLimitedResponse(result);
  return handlers.POST(request);
}
