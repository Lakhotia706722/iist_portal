# Architecture Decisions — IIST Career Portal

This file records the binding architectural decisions for this codebase. Read it
before adding a feature. Decisions marked **OVERRIDE** supersede the original
project spec and are final — do not re-litigate them in a later session.

---

## 1. Mutations go through REST route handlers — **OVERRIDE** (Phase 3.5)

**Decision:** REST route handlers under `app/api/**`, called from the client via
TanStack Query, are the locked mutation pattern. **No Server Actions.**

The original spec called for Server Actions as the default mutation path. By the
end of Phase 3 the codebase had ~60 working route handlers and no Server Actions
at all. Retrofitting them would have been pure churn for no functional gain, so
the convention that actually exists is now the sanctioned one.

Every new Phase 4/5 feature follows this same convention:

```
app/api/<area>/<resource>/route.ts     GET (list) + POST (create)
app/api/<area>/<resource>/[id]/route.ts    GET + PATCH/PUT + DELETE
```

- No `"use server"` anywhere in the codebase.
- Client components fetch and mutate with TanStack Query, invalidating query
  keys on success.

## 2. TanStack Query is a locked dependency (Phase 3.5)

`@tanstack/react-query` is the client data layer, mounted in
`components/providers.tsx`. It was already the de facto choice and fits the REST
convention above. Use it rather than bare `useEffect` + `fetch`.

## 3. Authorization is enforced per route handler

Middleware (`middleware.ts`) authenticates and gates **page** routes by URL
prefix. It does **not** authorize `/api/**` — the matcher has no `/api` entries
by design.

Therefore **every** API handler must call a guard from
`lib/rbac/server-guard.ts` before doing any work:

```ts
export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("offer:write");
    // ...
  } catch (error) {
    return handleApiError(error);
  }
}
```

- `requireAuth()` — any signed-in user
- `requireRole("TP_ADMIN", ...)` — role check
- `requirePermission("area:action")` — preferred; checks the matrix in `lib/rbac/index.ts`

`checkPermission()` returns a **boolean and does not throw** — it is for UI
conditionals only. Never use it as a route guard.

Permission scoping note: `offer:read` is granted to students (their own
placement history). Admin-wide listings use `offer:read:all`. When adding a
permission, check whether students already hold the read variant before reusing
it to gate an admin endpoint.

`scripts/audit-route-guards.ts` statically verifies every exported handler has a
guard. Run it after adding routes.

## 4. Services live in `server/services/` — one directory only

All business logic lives in `server/services/*.service.ts`. The former
`lib/services/` directory (Phase 3) was merged here in Phase 3.5; there is no
second location.

Route handlers stay thin: guard → validate (Zod) → call service → respond.

## 5. Every state-changing placement action writes an AuditLog row

Call `writeAuditLog()` from `server/services/audit.service.ts` inside the
service (not the route), after the write succeeds:

```ts
await writeAuditLog({
  userId: changedById,
  action: "STATUS_CHANGE",
  entity: "Offer",
  entityId: id,
  oldValues: { status: before.status },
  newValues: { status: offer.status },
});
```

Audit failures are swallowed by design — they must never break the operation.
Services that mutate placement state take an actor id parameter so the row can
name a user; thread it from the route's guard result.

Covered today: drive create/update/status, round creation, application status
change, bulk + CSV shortlisting, attendance (single + bulk), all offer actions,
and the Phase 1–2 CRUD services.

## 6. File storage only through the storage interface

`lib/storage/index.ts` defines `StorageAdapter` (`upload`, `download`,
`getSignedUrl`, `exists`, `delete`) with local and S3 implementations, selected
by `STORAGE_DRIVER`.

**Never** use `fs` or an S3 client outside `lib/storage/`. Build keys with
`buildStorageKey(prefix, ownerId, fileName)`; store the returned **key** in the
database (`*Key` columns), never a URL. Serve local files through
`/api/files/[key]`, which is auth-gated.

A flat `lib/storage.ts` shim used to shadow this module and silently disabled
the adapter — it was deleted in Phase 3.5. Do not reintroduce a
`lib/storage.ts`; the directory module must stay the only resolution target.

## 7. Policy values

Placement/eligibility rules are data: `EligibilityRule` rows evaluated by
`lib/eligibility-engine`. Nothing about eligibility is hardcoded.

Policy values (SkillUp requirement, minimum SkillUp score, high-package
threshold, max offers per student, min CTC difference between offers,
minimum attendance, withdrawal-after-shortlist, document-verification
requirement, "already placed" statuses, profile-completion weights) live in
`PolicyRule` — see `lib/policy/keys.ts` for the canonical key registry and
`server/services/policy.service.ts` for resolution (batch override → global
override → coded default). Read a value with `getPolicyValue(key, batchId)`;
never hardcode a threshold that's in that registry. Both hardcoded spots from
Phase 4 (profile-completion weights, the eligibility engine's "already
placed" check) now read from policy with a safe fallback to the old default
if unconfigured.

## 8. Student identity: `User.id` is not `Student.id`

They are distinct cuids, so passing one where the other is expected fails
silently or throws deep in a query. Always resolve with
`getStudentIdFromUserId()` from `lib/auth/student-session.ts`. Session claims
carry `studentId`, but it is only populated at login — prefer the helper.

## 9. Database migrations

Schema changes ship as Prisma migrations (`prisma/migrations/`), never `db push`
alone. Verify with `prisma migrate deploy` against a fresh database and
`prisma migrate diff --exit-code` to confirm no drift.

Always use `prisma migrate dev --name <name>` and let it generate the
timestamp — never hand-set one. If the sandbox's system clock lags behind an
earlier session's migration folder names (it can, if a prior migration's
timestamp was hand-set into the future), a same-day migration may sort before
one it doesn't actually depend on; that's harmless *only* if the new
migration has no FK to a table created by the later-sorting one. If it does,
either wait for real time to catch up (do other work, then run the migration)
or restructure the dependency — don't hand-set the timestamp to fix it.

## 10. Compliance status is derived, never stored

A student's placement compliance status (Eligible / Conditional / Restricted
/ Placed / Debarred) is computed on every read by
`server/services/compliance.service.ts` `getComplianceStatus()` — from
`PolicyRule` values, `DisciplineIncident` history, attendance, documents, and
SkillUp results. The only stored exception is an admin override
(`ComplianceOverride`, one row per student, requires a reason, audit-logged).
Precedence: `Student.isDebarred` → active override → computed. Never add a
`complianceStatus` column to `Student` — compute it.

## 11. AI features: hard traceability constraint

The AI resume builder must never let AI-invented content into a resume.
`server/services/ai-resume.service.ts` builds a fixed list of the student's
*verified* profile facts (skills, projects, internships, certifications,
achievements — nothing else), passes only that list into the prompt, and then
runs every AI-drafted bullet's claimed source back through
`enforceTraceability()` — a token-overlap check against the same verified
list — before the bullet is even returned to the client. Untraced bullets are
dropped server-side, not flagged-and-shown. `approveResumeDraft()` re-runs
this check against the student's *current* profile at save time (not just
what was returned at generation time) before writing a new `ResumeVersion`.
Any new AI feature that generates content referencing the student's own data
must follow this pattern — never trust the model's self-reported citation.

## 12. Rate limiting

`lib/rate-limit.ts` is an in-memory, per-process, fixed-window limiter keyed
by IP + a bucket name. It's applied to auth endpoints (login via the NextAuth
catch-all, forgot/reset/change-password) and the application-submit endpoint.
It is **not** shared across instances — if this app is ever deployed with
more than one Next.js server process, swap the in-memory `Map` for Redis (or
similar) keeping the same `checkRateLimit(request, {bucket, limit, windowMs})`
signature so call sites don't need to change.

---

## 13. Dependency security posture (Phase 6)

`npm audit` findings as of Phase 6, and what was done about each. Re-run
`npm audit` before every deploy — this table is a snapshot, not a promise.

**Fixed this phase** (patch/minor bumps, no breaking changes, each
re-verified against the app's actual behavior, not just "install succeeded"):

| Package | Change | Verified by |
|---|---|---|
| `@auth/core` (via `next-auth`) | `next-auth` `5.0.0-beta.28` → `5.0.0-beta.32` (pulls `@auth/core@0.41.3`) | `scripts/verify-phase5.ts` (41 checks incl. real login flow) against a fresh dev server |
| `nodemailer` | `^6.10.1` → `^8.0.11` | Same `verify-phase5.ts` run (dev-fallback mail path exercised) |
| `postcss` (nested under `next`'s own dependency tree, pinned internally to `8.4.31`) | Scoped override `"next": {"postcss": "^8.5.28"}` in `package.json` | `next build` completes; our own top-level `postcss@^8` devDependency is untouched — confirmed via `npm ls postcss` showing two independently-resolved copies |
| `uuid` (nested under `exceljs`) | Scoped override `"exceljs": {"uuid": "^11.1.1"}` | Direct test: generated a real XLSX report through `lib/reports/registry.ts` and opened it — row data and formatting intact |

Net result: `npm audit` went from 11 findings (2 critical, 2 moderate) to 8
findings (0 critical, 0 moderate), collapsing to exactly two independent
root causes — both below.

**Accepted risk — deferred, with reasoning:**

1. **`nodemailer` — remaining advisory on the `raw` MIME option.**
   `lib/email/index.ts` calls `createTransport().sendMail()` exclusively with
   `{from, to, subject, html, text, replyTo}` — the vulnerable `raw` option is
   never used anywhere in this codebase (confirmed by direct read of every
   call site). Accepted as-is; revisit only if a future feature needs raw
   MIME construction, at which point re-audit before adding that call.
   `npm audit` also flags `@auth/core`, `@auth/prisma-adapter`, and
   `next-auth` itself as "high" — these are not independent issues, they're
   this same nodemailer advisory surfacing transitively (nodemailer is a
   dependency of `@auth/core`'s email-provider support), so the same
   reasoning covers all four rows. **Do not** run `npm audit fix --force`
   here — its suggested "fix" is downgrading `next-auth` to `1.12.1`, an
   ancient pre-v5 release; that's npm's audit tool finding *a* version
   without the flag, not a real, compatible fix path.

2. **`next` / `eslint-config-next` / `@next/eslint-plugin-next` / `glob` —
   Next.js 14 → 16 major-version cluster.** The remaining advisories all
   trace back to Next.js 14's own transitive deps; fixing them requires a
   major-version bump of Next itself (14 → 15 → 16), which is explicitly out
   of scope for this pass (App Router behavior, middleware API, and the
   Auth.js v5 beta integration all need a dedicated regression pass before
   that upgrade is safe). Accepted as a known gap. **Revisit trigger:** the
   next scheduled maintenance window after launch, or immediately if a
   CVE in this cluster is confirmed exploitable against code paths this app
   actually uses (most of the flagged surface is dev-time tooling, not
   request-handling code).

**Re-checked 2026-09-09** (fresh `npm audit`, not the Phase 6 snapshot above —
the advisory database itself had updated overnight and surfaced two *new*
critical CVEs against `next@14.2.35` that weren't present in the earlier
run): `GHSA-p293-qw3h-jr36` (unauthenticated RCE, but explicitly scoped to
**Windows-hosted** servers via path traversal — this app deploys to Vercel,
Linux-based, so this specific CVE is not applicable to our deployment target)
and `GHSA-2xp9-vwfh-vxw4` (unauthenticated RCE via a crafted AVIF file
processed by the Image Optimization API — no platform restriction, and
**this one is applicable**: both `next.config.mjs`'s `images.remotePatterns`
of `**` and the fact that `validateFileUpload()`
([lib/api-utils.ts](lib/api-utils.ts#L163)) only checks the client-supplied
`file.type` — not the actual file bytes — mean an authenticated user
(a TP_ADMIN uploading a company logo, or a student uploading a project
image) could in principle upload a file mislabeled as JPEG/PNG whose real
bytes are a malicious AVIF, which would then be run through Next's
server-side optimizer wherever that image is rendered via `next/image`.

Both CVEs still only resolve via the same Next 14→16 major bump documented
above (no 14.x patch release fixes them per `npm audit`'s `fixAvailable`), so
the version bump itself stays deferred per the reasoning above. But the
AVIF/optimizer chain doesn't require waiting for that bump to close — it was
mitigated directly this session: every one of the 5 `next/image` usages in
the codebase (`application-card.tsx`, `journey-page.tsx`,
`opportunity-card.tsx`, `opportunity-header.tsx` — all rendering
`company.logoUrl` — and `projects-client.tsx` rendering a student's project
`imageUrl`) now sets `unoptimized`, which skips the Image Optimization API
entirely for these sources; the browser renders the original bytes directly
instead. This is the only place in the app any user/admin-uploaded image
reaches `next/image`, confirmed by grepping every `from "next/image"` import
in the repo. Verified: `tsc --noEmit`, `next lint`, `next build`, and the
full Vitest suite all still pass after this change.

**Recommended follow-up (not done this pass — would need a new dependency,
e.g. `file-type`, to sniff magic bytes server-side, which is out of scope for
a dependency-security-focused pass):** add real content-based file-type
validation in the upload route handlers so a mislabeled file is rejected at
upload time, not just prevented from reaching the optimizer. The current
`unoptimized` mitigation closes the specific RCE vector; it doesn't stop a
mislabeled file from being stored at all.

## 14. Content-Security-Policy: nonce-based, via middleware (Phase 6)

Decided **not** to leave this as an accepted risk — Next.js's middleware-based
nonce support (no custom server required) covers it:

- `middleware.ts` generates a fresh nonce per request
  (`crypto.randomUUID()` → base64) and builds the `Content-Security-Policy`
  header itself (`buildCsp()`), applied to every response path (redirects and
  `next()`) via `withCsp()`.
- The nonce is forwarded to Server Components via an `x-nonce` request
  header; `app/layout.tsx` reads it with `headers().get("x-nonce")` in the
  request path, which is how Next detects the nonce and applies it to its
  own injected bootstrap/hydration `<script>` tags automatically. The app
  has no custom inline `<script>` tags of its own that need an explicit
  nonce prop threaded through `Providers`.
- `script-src` is `'self' 'nonce-<value>' 'strict-dynamic'` in production
  (`'unsafe-eval'` instead of `'strict-dynamic'` in development, for webpack
  HMR only — never shipped).
- `style-src` keeps `'unsafe-inline'`: Tailwind's runtime style injection and
  several UI libraries emit inline `style` attributes with no nonce-plumbing
  path short of forking them. A style-src XSS is a materially narrower
  vector than script-src, which is why this one inline allowance stays.
- The middleware matcher now **includes** the public auth pages (`/login`,
  `/forgot-password`, `/reset-password`, `/unauthorized`) instead of
  excluding them, so they also get the nonce-based CSP; the middleware
  function itself early-returns past the auth/role checks for those via a
  `PUBLIC_PAGES` list. Only `/api/auth` (NextAuth's own routes — no HTML
  response to protect) stays excluded from the matcher.

Verified: `tsc --noEmit` and `next build` both pass clean after this change;
see `scripts/verify-phase6.ts` for the runtime check that `/login` (public)
and an authenticated page both return a `Content-Security-Policy` header
containing a nonce.

---

## 15. Faculty / HOD / Company Rep portal scoping (Phase 7)

Before this phase, HOD reached straight into admin-owned pages (`/hod/analytics`
rendering the same `AnalyticsClient` as `/admin/analytics`, hitting the same
unscoped `analytics:read`-gated routes), Faculty had no dashboard at all, and
Company Rep held `drive:read` / `company:read` / `application:read:all` /
`shortlist:read` — the *unrestricted* variants meant for admin/faculty/hod —
which meant a company rep who called the existing `/api/admin/drives/[id]`
or `/api/admin/drives/[id]/applications` routes directly could see **any**
company's drive and applicant data, and `offer:write` (needed for legitimate
status updates) had no ownership check at all, so a rep could change the
status of *any* company's offer. Neither was ever exploited in practice —
the old `/company` frontend never called those routes — but both were real,
reachable gaps, not hypothetical ones.

**Faculty** (`server/services/faculty.service.ts`, `/faculty/dashboard`,
`/faculty/students`): no permission changes — faculty already held
`student:read:all` etc. unrestricted, same as HOD/TP_ADMIN, and still do.
This phase only gave them a real home base (their own created tests/
interviews with participation counts, a department-scoped "needs attention"
list) and a read-only assigned-students view. No new write capability.

**HOD** (`server/services/hod.service.ts`, `/hod/dashboard`, `/hod/students`,
`/hod/compliance`): also no permission changes — `analytics:read` /
`student:read:all` / `compliance:read:all` stay unrestricted at the RBAC
level (HOD and TP_ADMIN share them). What changed is enforcement:
`getDepartmentIdForHod()` resolves the caller's own `HodProfile.departmentId`
server-side and every one of these three routes hard-filters on it
(`{ branch: { departmentId } }`, the same shape `search.service.ts` already
used for HOD/FACULTY-scoped search) — there is no client-supplied
department parameter to pass a different value into. `getDepartmentAnalytics()`
(existing, unmodified) is reused directly for the dashboard's placement-rate/
package figures. `compliance:write` (overrides) was already TP_ADMIN-only in
the RBAC matrix — confirmed, not changed.

**Deliberate scope decision — `/hod/analytics` and `/hod/audit-logs` stay
institute-wide, not department-scoped.** These two pre-existing pages reuse
the admin `AnalyticsClient`/`AuditLogClient` components and remain reachable
with full cross-department visibility (department-breakdown table, company
summaries, full audit trail). Left as-is deliberately, not overlooked:
1. They only ever surface **aggregate** figures (counts, rates) or
   institute-wide operational history — never individual student PII, which
   is the actual sensitive surface (that's what `/hod/students` and
   `/hod/compliance` scope down).
2. `AuditLog` entries aren't cleanly department-partitionable — most rows
   (PolicyRule changes, User management, Company/Drive edits) have no
   student/department association at all.
3. The new `/hod/dashboard` is the properly department-scoped analytics view
   the phase spec asked for and fully satisfies it on its own; `/hod/analytics`
   is legacy-reachable, not the primary path.
**Revisit trigger:** if `/hod/analytics`'s department-breakdown table is ever
extended to include individual student rows (currently aggregate-only), scope
it the same way `/hod/students` is scoped.

**Company Rep** (`server/services/company-rep.service.ts`, `/api/company/*`,
`/company/dashboard`, `/company/drives/[id]`, `/company/offers`) — the real
work of this phase:
- **Schema:** `CompanyRepProfile.companyId` (nullable FK → `Company`) added
  via `prisma migrate dev` (migration `20260909105259_phase7_company_rep_scoping`).
  Nullable so an admin can create the account before the Company row exists;
  every `/api/company/*` route treats `companyId: null` as "not linked yet"
  and fails closed with a 400, never an unscoped fallback (verified in
  `scripts/verify-phase7.ts`).
- **RBAC:** `COMPANY_REP` no longer holds `company:read` / `drive:read` /
  `jobrole:read` / `application:read:all` / `shortlist:read` (the
  unrestricted variants). It now holds four new, deliberately narrow
  permissions — `company:read:own`, `drive:read:own`,
  `application:read:company`, `offer:read:company` — each served only by
  `/api/company/*` routes that resolve `companyId` from the caller's own
  `CompanyRepProfile` via `getCompanyIdForRep()`, never from a client value.
  `offer:write` stays (needed for status updates), but is now scoped: both
  the new `/api/company/offers/[id]/status` route *and* the legacy
  `/api/admin/offers/[id]/status` / `/api/admin/offers/[id]/letter` routes
  (which COMPANY_REP can still technically reach and legitimately need for
  some flows) call `assertOfferOwnedByCallerIfCompanyRep()` first — closing
  the offer:write gap at its source, not just in the new routes.
- **The field allowlist** (`APPLICANT_SELECT` in `company-rep.service.ts`) —
  the one place under-scoping would leak student data across companies.
  Included: student name, enrollment number, branch, batch, the resume
  version actually submitted with that application (signed URL), application
  status, and per-round `result` + attendance status. Excluded, explicitly:
  every Student PII field beyond name/branch/batch (DOB, gender, category,
  religion, aadhar, phone numbers, addresses, family details, physical
  stats, passport — see the `Student` model), `Application.adminNote` and
  `.eligibilitySnapshot` (internal), any other application the student made
  (to this or another company), and `RoundParticipant.remarks`/`.nextAction`
  (internal interviewer notes — only `result` is exposed). Enforced as an
  explicit Prisma `select` (not `include`), not a UI-level hide. Verified in
  `scripts/verify-phase7.ts` by asserting the raw JSON response contains
  none of these field names.
- **Cross-company isolation:** every company-scoped route 404s (not 403s) on
  a foreign drive/offer ID — a rep has no legitimate reason to learn a
  foreign ID even exists, same reasoning as the rest of the RBAC error
  convention. Verified with two real accounts against two real companies
  (ISRO / Verify Corp) in `scripts/verify-phase7.ts`: cross-company drive
  read, applicant list, offer read, and offer *write* (both the new and the
  legacy admin route) are all confirmed blocked.
- **Pre-placement talk:** read access opened to company reps for their own
  drive's PPT info (schedule, venue, attachments) — a rep naturally wants to
  see what's been shared about their drive. Authorship (create/edit) stays
  admin-only; reps never hold `drive:write`, so the existing write paths were
  already closed to them and are unchanged. Deliberate choice, documented
  per the same format as the analytics/audit-log decision above.

---

## Testing

- `npm test` — Vitest (jsdom). Component and unit tests live beside their source.
- `npx tsx scripts/verify-phase35.ts` — eligibility + offer lifecycle against the dev DB
- `npx tsx scripts/verify-audit.ts` — audit coverage for placement actions
- `npx tsx scripts/audit-route-guards.ts` — static route-guard audit
- `npx tsx scripts/verify-http.ts` — HTTP smoke test against a running dev server
- `npx tsx scripts/verify-p0-tabs.ts [baseUrl]` — Phase 4 drive applications/attendance tabs
- `npx tsx scripts/verify-phase4.ts [baseUrl]` — SkillUp/interviews/notifications/calendar E2E
- `npx tsx scripts/verify-pages4.ts [baseUrl]` — Phase 4 page-render smoke test
- `npx tsx scripts/verify-phase5.ts [baseUrl]` — policy/compliance/AI/analytics/reports/search/audit/hardening E2E
- `npx tsx scripts/verify-pages5.ts [baseUrl]` — Phase 5 page-render smoke test
- `npx tsx scripts/verify-phase6.ts [baseUrl]` — CSP nonce coverage (public page, redirect response, per-request uniqueness)
- `npx tsx scripts/verify-storage-adapter.ts` — storage adapter E2E (upload/exists/download/getSignedUrl/delete) against whichever `STORAGE_DRIVER` is set — run once against `local`, again against `s3` with real credentials before deploy
- `npx tsx scripts/migrate-local-storage-to-s3.ts` — one-off local→S3 file migration (no-op if, as of Phase 6, no files were ever stored locally)
- `npx tsx scripts/verify-phase7.ts [baseUrl]` — Faculty/HOD/Company Rep portal E2E, incl. cross-department and cross-company isolation with two real accounts each, and the applicant field-allowlist check
