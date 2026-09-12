/**
 * AI usage governance — Phase 16, P6.
 *
 * Every AI-calling route (career-recommendations, interview-practice,
 * jd-analysis, resume-draft, resume-match, skill-gap) calls
 * `enforceAiUsageLimit()` before generating, and `logAiUsage()` is called
 * by lib/ai/anthropic-provider.ts after every real Anthropic call
 * completes. Two separate reasons this exists:
 *
 * 1. Cost control — 1000+ students, each able to generate resume drafts/
 *    career advice/etc. on demand, is a real, direct Anthropic API cost.
 *    A per-student daily cap bounds the worst case; a tighter per-minute
 *    burst cap stops a scripted loop from running up cost in seconds.
 * 2. Cost visibility — logAiUsage() writes one row per call so "how much
 *    are we actually spending" is answerable at any time, not discovered
 *    at the end of a billing cycle. See getAiUsageSummary() /
 *    /api/admin/ai-usage.
 */

import { checkRateLimitForKey } from "@/lib/rate-limit";
import { RateLimitedError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

/** Generations per student per rolling day. Documented, not hidden in code. */
const DAILY_LIMIT = 20;
/** Per minute — guards against a scripted burst, not normal interactive use. */
const BURST_LIMIT = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Throws RateLimitedError (mapped to a 429 by handleApiError, with a clear
 * "try again in a moment"-style message) if the caller has hit either cap.
 * Call this BEFORE the Anthropic call, so a capped student never pays the
 * latency of a call that will be rejected anyway... except the cap itself
 * is about calls that already happened, so this is really about stopping
 * the *next* one, which is the point.
 */
export async function enforceAiUsageLimit(userId: string): Promise<void> {
  const burst = await checkRateLimitForKey(userId, { bucket: "ai-burst", limit: BURST_LIMIT, windowMs: 60_000 });
  if (!burst.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil((burst.resetAt - Date.now()) / 1000));
    throw new RateLimitedError(
      "You're generating AI content too quickly. Please wait a moment and try again.",
      retryAfterSeconds
    );
  }

  const daily = await checkRateLimitForKey(userId, { bucket: "ai-daily", limit: DAILY_LIMIT, windowMs: DAY_MS });
  if (!daily.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil((daily.resetAt - Date.now()) / 1000));
    throw new RateLimitedError(
      `You've reached today's limit of ${DAILY_LIMIT} AI generations. Try again tomorrow.`,
      retryAfterSeconds
    );
  }
}

// Anthropic list pricing this constant assumes (Sonnet 5, per million
// tokens, USD) — rough only; update if the model or list price changes.
// This is deliberately a *documented estimate*, not a billing-accurate
// figure — see the module doc comment.
const INPUT_COST_PER_MILLION = 3;
const OUTPUT_COST_PER_MILLION = 15;

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * INPUT_COST_PER_MILLION + outputTokens * OUTPUT_COST_PER_MILLION) / 1_000_000;
}

/** Fire-and-forget from the caller's perspective is NOT safe on serverless
 * (the function can freeze right after this returns) — always await this. */
export async function logAiUsage(
  userId: string,
  feature: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  try {
    await prisma.aiUsageLog.create({
      data: {
        userId,
        feature,
        inputTokens,
        outputTokens,
        estimatedCostUsd: estimateCostUsd(inputTokens, outputTokens),
      },
    });
  } catch (err) {
    // Usage logging must never break the actual AI feature it's observing.
    console.error("[ai-usage] failed to log usage row:", err);
  }
}

export interface AiUsageSummary {
  date: string; // YYYY-MM-DD (UTC)
  calls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

/** Per-day aggregate for the last N days, most recent first — the "cost visible" view. */
export async function getAiUsageSummary(days = 30): Promise<AiUsageSummary[]> {
  const since = new Date(Date.now() - days * DAY_MS);
  const rows = await prisma.aiUsageLog.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, inputTokens: true, outputTokens: true, estimatedCostUsd: true },
  });

  const byDay = new Map<string, AiUsageSummary>();
  for (const row of rows) {
    const date = row.createdAt.toISOString().slice(0, 10);
    const entry = byDay.get(date) ?? { date, calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 };
    entry.calls += 1;
    entry.inputTokens += row.inputTokens;
    entry.outputTokens += row.outputTokens;
    entry.estimatedCostUsd += row.estimatedCostUsd;
    byDay.set(date, entry);
  }

  return [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date));
}
