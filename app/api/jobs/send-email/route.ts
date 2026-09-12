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
 *
 * That verification helper THROWS AT IMPORT TIME (not just at request
 * time) when the two signing-key env vars are unset — which crashed the
 * entire `next build` outright, not just this one route, since Next
 * loads every route module during its build-time page-data collection.
 * Since lib/queue/qstash.ts already never calls this route at all when
 * QSTASH_TOKEN is unset (falling back to sending inline instead — see
 * lib/notifications/index.ts), this route is simply unreachable in that
 * configuration; it only needs to not crash the build. Wrapping is
 * therefore conditional on the signing keys actually being present —
 * without them, POST unconditionally 404s (this route "doesn't exist"
 * rather than existing-but-unauthenticated).
 */
import { NextResponse } from "next/server";
import { sendEmail, type EmailOptions } from "@/lib/email";

async function handler(request: Request) {
  const body = (await request.json()) as EmailOptions;
  await sendEmail(body);
  return NextResponse.json({ ok: true });
}

const QSTASH_SIGNING_CONFIGURED = !!(
  process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY
);

export const POST = QSTASH_SIGNING_CONFIGURED
  ? // eslint-disable-next-line @typescript-eslint/no-var-requires
    (require("@upstash/qstash/nextjs").verifySignatureAppRouter(handler) as typeof handler)
  : async () => NextResponse.json({ error: "Not found" }, { status: 404 });
