/**
 * Background job queue — Phase 16, P4.
 *
 * The brief's original plan was Next.js `after()` for single-recipient
 * sends and Upstash QStash only for bulk. `after()` (as `unstable_after`)
 * does not exist in any stable Next.js 14.x release — it shipped stable
 * only in Next 15 — and this project is pinned to 14.2.35. Upgrading
 * Next's major version is a real, separate risk this stability-focused
 * phase should not take on as a side effect of one P4 sub-item. Instead,
 * every email send — single-recipient or bulk — goes through this one
 * QStash-backed queue. This is at least as good as `after()` for the
 * single case (real retry semantics, survives the function actually
 * freezing post-response, which a bare `after()`-scheduled callback does
 * not protect against either) and is exactly what the brief already
 * wanted for bulk, so there is no second mechanism to maintain.
 *
 * Without QSTASH_TOKEN configured (local dev, or before it's provisioned),
 * enqueueJob() is unavailable and callers fall back to sending
 * synchronously in the request path — see lib/notifications/index.ts.
 * That fallback is correct for local dev but does not decouple anything;
 * production needs QSTASH_TOKEN set.
 */

import { Client } from "@upstash/qstash";

let client: Client | null = null;

export function isQueueConfigured(): boolean {
  return !!process.env.QSTASH_TOKEN;
}

function getClient(): Client {
  if (!client) client = new Client({ token: process.env.QSTASH_TOKEN! });
  return client;
}

/**
 * Enqueue a job for a QStash-invoked callback route under /api/jobs/*.
 * `endpointPath` must be an absolute path (e.g. "/api/jobs/send-email").
 * QStash calls back on NEXT_PUBLIC_APP_URL + endpointPath, signed so the
 * callback route can verify the request really came from QStash (see
 * verifySignatureAppRouter in each /api/jobs/* route).
 */
export async function enqueueJob(endpointPath: string, body: unknown, retries = 3): Promise<void> {
  if (!isQueueConfigured()) {
    throw new Error("QSTASH_TOKEN is not set — enqueueJob() is unavailable. Callers must fall back to a synchronous path.");
  }
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await getClient().publishJSON({
    url: `${base}${endpointPath}`,
    body,
    retries,
  });
}

/**
 * Enqueue many jobs for the same endpoint in one QStash API call
 * (`batchJSON`) instead of one HTTP round-trip per recipient — the actual
 * fix for "a popular drive gets bulk-shortlisted and 300 emails need to go
 * out": the admin's request enqueues the batch and returns immediately,
 * QStash fans the 300 out (with per-job retries) from there.
 */
export async function enqueueJobs(endpointPath: string, bodies: unknown[], retries = 3): Promise<void> {
  if (bodies.length === 0) return;
  if (!isQueueConfigured()) {
    throw new Error("QSTASH_TOKEN is not set — enqueueJobs() is unavailable. Callers must fall back to a synchronous path.");
  }
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await getClient().batchJSON(
    bodies.map((body) => ({ url: `${base}${endpointPath}`, body, retries }))
  );
}
