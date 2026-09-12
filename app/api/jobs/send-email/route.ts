/**
 * QStash-invoked email send-out — Phase 16, P4.
 *
 * lib/notifications/index.ts enqueues one job here per recipient (whether
 * the triggering action was single-recipient or bulk — see the reasoning
 * in lib/queue/qstash.ts) instead of sending inline in the request that
 * shortlisted/offered/etc. QStash retries on failure (network blip, SMTP
 * hiccup) with real backoff — something a fire-and-forget promise in the
 * original request could never do once that request had already
 * returned.
 *
 * verifySignatureAppRouter checks the QStash-Signature header against
 * QSTASH_CURRENT_SIGNING_KEY/QSTASH_NEXT_SIGNING_KEY — without this, this
 * route would be an open relay anyone could POST arbitrary email through.
 */
import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { sendEmail, type EmailOptions } from "@/lib/email";

async function handler(request: Request) {
  const body = (await request.json()) as EmailOptions;
  await sendEmail(body);
  return NextResponse.json({ ok: true });
}

export const POST = verifySignatureAppRouter(handler);
