/**
 * Runtime-validated fetch — Phase 10.
 *
 * Every real bug Phase 9 found (except the two genuine UI stubs) was the
 * same shape: a client component's hand-typed interface for an API
 * response didn't match what the route actually returns, and nothing
 * caught it until a real browser rendered the mismatch as a crash or a
 * silently-empty list. TypeScript can't catch this — `await res.json()`
 * returns `any`, so the "types" on either side were never actually checked
 * against each other, just against themselves.
 *
 * `fetchJson()` closes that gap for API-*consuming* client code the same
 * way Zod already closes it for API *request* validation: parse the real
 * response through a schema before a component ever touches it. A
 * mismatch becomes an immediate, loud, caught error — in dev, logged with
 * the actual diff — instead of a downstream crash three components away.
 *
 * Adopt for any new client fetch call, and for any existing one you touch
 * while fixing a bug. Not a mandate to retrofit every fetch in the app in
 * one sitting — see ARCHITECTURE.md's "Runtime-validated API responses"
 * section for the full policy.
 */

import { z } from "zod";

export class ApiResponseShapeError extends Error {
  constructor(
    public url: string,
    public issues: z.ZodIssue[]
  ) {
    super(
      `API response from ${url} didn't match the expected shape:\n` +
        issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n")
    );
    this.name = "ApiResponseShapeError";
  }
}

export class ApiRequestError extends Error {
  constructor(
    public url: string,
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/**
 * Fetch `url`, then parse the JSON body through `schema`. Throws
 * `ApiRequestError` on a non-2xx response (using the API's own `error`
 * message when present) and `ApiResponseShapeError` — logged loudly via
 * console.error first, with the exact field-level diff — when the body
 * doesn't match `schema`.
 */
export async function fetchJson<T>(
  url: string,
  schema: z.ZodType<T>,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON response (e.g. an HTML error page) — fall through, the
    // !res.ok branch below produces a clear error either way.
  }

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "error" in body && typeof (body as any).error === "string"
        ? (body as any).error
        : null) ?? `Request to ${url} failed (${res.status})`;
    throw new ApiRequestError(url, res.status, message);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    console.error(`[fetchJson] Response shape mismatch for ${url}:`, parsed.error.issues, "raw body:", body);
    throw new ApiResponseShapeError(url, parsed.error.issues);
  }
  return parsed.data;
}
