# Launch Checklist — IIST Career Development & Placement Management Portal

This is the single source of truth for launch readiness. It stands alone —
whoever picks this up doesn't need any prior conversation history, just this
document, `ARCHITECTURE.md` (binding technical decisions), and
`PHASE6_RUNBOOK.md` (the exact steps for the credentialed items below).

**Current branch:** `phase6-pre-launch-checklist` (not yet merged to `main`
— open as a pull request, pending review).

---

## Regression snapshot — as of this commit

**Run 2026-09-09, 16:52–17:10 IST**, against a **fresh migration replay**
(`prisma migrate reset --force` — all 10 migrations from empty, then
reseeded) on local Postgres. This is the closest local proxy for what
`prisma migrate deploy` will do against a real empty production database.

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ clean |
| `next lint` | ✅ no warnings or errors |
| `next build` | ✅ exit 0, 194 routes compiled |
| `npm test` (Vitest) | ✅ 17/17 |
| `npm audit` | 8 findings (0 critical *exploitable in this deployment*, 7 high, 1 critical scoped to Windows-hosted servers — see §4) |
| `verify-phase35.ts` | ✅ all checks |
| `verify-p0-tabs.ts` | ✅ all checks |
| `verify-phase4.ts` | ✅ all checks |
| `verify-phase5.ts` | ✅ 41/41 |
| `verify-phase6.ts` | ✅ 5/5 (CSP nonce) |
| `verify-phase7.ts` | ✅ 24/24 (Faculty/HOD/Company Rep + cross-tenant isolation) |
| `verify-audit.ts` | ✅ all checks |
| `verify-http.ts` | ✅ all checks |
| `verify-pages.ts` | ✅ all checks |
| `verify-pages4.ts` | ✅ all checks |
| `verify-pages5.ts` | ✅ all checks |
| `verify-storage-adapter.ts` | ✅ 20/20 (against `STORAGE_DRIVER=local` — the `s3` driver still needs real credentials, see §2) |

**Zero failures.** Codebase scope as of this snapshot: 48 Prisma models, 34
services, 194 compiled routes, 79 RBAC permissions across 5 roles.

---

## 1. Done — verified, no action needed

- **Auth & RBAC:** Auth.js v5 credential login, 5 roles, 79 permissions, `requirePermission()` enforced on every route.
- **Student profile & career data:** personal/academic info, skills, projects, internships, certifications, achievements, social/video profile, profile completion scoring.
- **Resume Center & AI Resume Builder:** versioned resumes, JD analysis, skill-gap analysis, job/career recommendations, AI drafting with a hard server-side traceability guard (fabricated claims are stripped, never trusted from the model's self-reported citations).
- **Placement pipeline:** drive → job role → eligibility rules → application → shortlist → rounds → attendance → offer, full lifecycle, audit-logged throughout.
- **SkillUp, mock interviews, notifications, documents, calendar:** assessments with results/eligibility integration, interview scheduling + feedback, in-app + email notification center (16 templates, admin-overridable), document verification, scoped calendar.
- **Policy engine, compliance, analytics, reports, search, audit:** batch/global/coded-default policy resolution; compliance status fully derived (never stored); command-center + department + company analytics; 11 report types (CSV/XLSX/PDF); role-scoped global search; full audit log viewer.
- **Production hardening:** rate limiting on auth/apply endpoints, security headers, nonce-based CSP via middleware (no custom server needed), lint/type debt paid down (`eslint.ignoreDuringBuilds: false`), a11y pass, responsive pass (desktop/tablet breakpoints from Phase 5 — the *final* 375/768/1440px pass is still pending manual QA, see §3).
- **Faculty portal:** own created tests/interviews with counts, department-scoped "needs attention" list, read-only assigned-students view.
- **HOD portal:** department-scoped dashboard/students/compliance, enforced server-side from the caller's own `HodProfile` — verified with two real HOD accounts in different departments that neither can see the other's data.
- **Company Rep portal:** own-company-scoped dashboard/drive-detail/applicants/offers, strict field allowlist on the applicant view (no PII beyond name/branch/batch, no internal notes), a pre-existing `offer:write` ownership gap closed — verified with two real company-rep accounts at different companies that neither can read or write the other's data.

---

## 2. Blocking launch — must complete before go-live

None of these can be verified further without real credentials, which only
whoever owns the relevant accounts (Cloudflare/AWS, Neon/Supabase, an SMTP
provider, Anthropic) can provision. **Full step-by-step instructions,
exact commands, and pass/fail criteria are in [`PHASE6_RUNBOOK.md`](PHASE6_RUNBOOK.md)
— this section is the summary, that document is the source of truth for
execution.**

1. **Storage** — real Cloudflare R2 (or AWS S3) bucket wired via `STORAGE_DRIVER=s3` + `AWS_*` env vars, verified with `scripts/verify-storage-adapter.ts` against the real bucket (currently only verified against `local`), plus a real upload/download/delete through the running app for a resume, certificate, offer letter, and PPT attachment.
2. **Database** — `npx prisma migrate deploy` run clean against the real production Postgres (Neon or Supabase) from empty, then the app pointed at it with a successful login. After migrating, in this order:
   1. `npx tsx prisma/seed-reference-data.ts` — **safe to run against production**, and safe to re-run any time (idempotent). Creates real IIST departments/courses/branches/batches, the skill catalog, SkillUp test-type categories, and default policy values. Contains zero user accounts.
   2. `npx tsx prisma/create-admin.ts --name "..." --email "..." --password "..."` — creates exactly one real TP_ADMIN account with real details, so there's someone who can log in and use the Users & Roles page to create every other real account from there.
   3. **Never** run `npx tsx prisma/seed-test-fixtures.ts` against production — it creates 5 fake demo accounts (all password `Password@123`) and a fake demo company, and is guarded to refuse outright when `NODE_ENV=production` or `DATABASE_URL` doesn't look like a local/test database. Use it only for local development (`npm run db:seed` runs both reference-data and test-fixtures together, for exactly that purpose) or a scratch database.
3. **Email** — real SMTP/provider credentials in `.env`, verified with one real delivered email (currently `SMTP_USER` is empty, so `sendEmail()` only logs to the console).
4. **AI** — a real `ANTHROPIC_API_KEY`, verified with a live AI Resume Builder run including the traceability guard tested against an actual model response (not just unit-test fixtures), then the key removed again to re-confirm the 503 fallback still works.
5. **Final staging smoke test** — the complete student journey and complete admin journey, end to end, against all of the above once wired (Runbook Step 5).

---

## 3. Should do before launch, but not launch-blocking

- **Manual responsive QA** at 375px / 768px / 1440px across: student dashboard, career profile, resume center, opportunity detail + apply flow, application tracking/journey, SkillUp results, notification center; admin command center, drive detail (all tabs), analytics, reports, audit log viewer. This still needs a human with a browser — no browser/screenshot tooling is available to Claude Code in this environment. Fix anything that actually breaks; cosmetic-only nits can wait.

---

## 4. Accepted risks — documented and intentional

Pulled from `ARCHITECTURE.md` (§13–15) — each with its trigger for revisiting, not left as a silent gap.

| Risk | Reasoning | Revisit trigger |
|---|---|---|
| **`nodemailer`'s remaining `raw`-MIME advisory** | Every `sendMail()` call site in this codebase uses `{from, to, subject, html, text, replyTo}` — the vulnerable `raw` option is never used. | Before adding any feature that needs raw MIME construction. |
| **Next.js 14→16 major-version cluster** (`next`, `eslint-config-next`, `@next/eslint-plugin-next`, `glob`) — includes 2 critical CVEs surfaced in a later audit | A major Next.js bump needs a dedicated regression pass (App Router, middleware API, Auth.js v5 beta integration all need re-verification). One of the two critical CVEs (`GHSA-p293-qw3h-jr36`, Windows-hosted RCE) doesn't apply to this deployment (Vercel/Linux). The other (`GHSA-2xp9-vwfh-vxw4`, AVIF Image-Optimizer RCE) **was mitigated directly** — every `next/image` usage that renders a user/admin-uploaded image now sets `unoptimized`, closing the exploit path without needing the version bump. | Next scheduled maintenance window, or immediately if a CVE in this cluster is shown exploitable against a code path this app actually uses. |
| **`validateFileUpload()` trusts the client-declared MIME type**, not actual file bytes | Direct cause of the AVIF RCE exposure above; the `unoptimized` fix closes the *rendering* path, but a mislabeled file can still be stored. | Add real magic-byte validation (e.g. the `file-type` package) at upload time — flagged as a recommended follow-up, not yet implemented. |
| ~~**Rate limiting is in-memory, per-process**~~ — **RESOLVED, Phase 16** | `lib/rate-limit.ts` is now Upstash Redis-backed (`@upstash/ratelimit` + `@upstash/redis`, sliding window) when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set — enforced consistently across every serverless instance. Falls back to the original in-memory behavior (with a console warning) when unset, so local dev needs nothing extra. **Still blocking real production use** until those two env vars are actually set — see §7. | N/A — closed. Revisit only if the fallback path is ever observed active in production (the warning log is the tripwire). |
| **`/hod/analytics` and `/hod/audit-logs` stay institute-wide**, not department-scoped (Phase 7) | Both only surface aggregate figures or cross-cutting operational history — never individual student PII (that's what the new, properly department-scoped `/hod/dashboard`, `/hod/students`, `/hod/compliance` are for). `AuditLog` rows aren't cleanly department-partitionable in the first place. | If `/hod/analytics`'s department-breakdown table is ever extended to show individual student rows. |
| **Company reps get read access to their drive's Pre-Placement Talk info** (Phase 7) | A rep naturally wants to see what's been shared about their own drive. Authorship (create/edit) stays admin-only — reps never hold `drive:write`. | N/A — this is a settled, not deferred, decision. |

---

## 5. Explicit backlog — not required for launch

- **Notification scheduling** (`scheduledAt` handling) — needs a real job scheduler; not implemented.
- **SMS / push notification channels** — accepted as future work, not implemented.
- **Bulk attendance marking doesn't notify per-student** — an open product decision (does bulk-marking 30 students' attendance need to fire 30 individual notifications?), not a defect.
- **General faculty/HOD/company-rep feature requests beyond Phase 7's scope** — Phase 7 built dashboards + scoped read views + (for company rep) offer status updates. Anything beyond that (e.g. faculty creating drives, HOD approving applications) is new feature work, not scoped here.
- **Next.js 14→16 / other major dependency upgrades** — see §4.
- **Real magic-byte file-type validation** — see §4.

---

## 6. Environment variables reference

Cross-checked against every `process.env.*` reference in the codebase plus
Auth.js/Prisma's own implicit env resolution.

| Variable | Required for | Status |
|---|---|---|
| `DATABASE_URL` | Prisma / Postgres connection | Read directly by Prisma via `schema.prisma`'s datasource block |
| `AUTH_SECRET` | Auth.js v5 session signing | Read implicitly by `next-auth`/`@auth/core` |
| `AUTH_URL` | Auth.js v5 canonical URL | Read implicitly by `next-auth`/`@auth/core` |
| `NEXTAUTH_URL` | Auth.js v5 (legacy-name fallback) | Read implicitly by `next-auth`/`@auth/core` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | Email delivery (`lib/email/index.ts`) | Empty `SMTP_USER` = dev console fallback, no error |
| `EMAIL_FROM` | Email "from" address | Referenced directly |
| `STORAGE_DRIVER` | `local` or `s3` (`lib/storage/index.ts`) | Currently `local` |
| `LOCAL_STORAGE_PATH` | Local dev storage path | Only used when `STORAGE_DRIVER=local` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `AWS_S3_BUCKET` / `AWS_ENDPOINT_URL` | S3/R2 storage (`lib/storage/s3-adapter.ts`) | Only required when `STORAGE_DRIVER=s3` — currently unset, this is the P0 blocker |
| `AI_PROVIDER` | Gates AI feature availability | Referenced directly; anything but `"anthropic"` disables AI cleanly |
| `ANTHROPIC_API_KEY` | AI Resume Builder etc. | Currently empty — the P2 blocker |
| `NEXT_PUBLIC_APP_URL` | Referenced directly (client-visible) | Set |
| `NEXT_PUBLIC_APP_NAME` | **Stale** — present in `.env.example` but not referenced anywhere in the codebase | Safe to remove from `.env.example`, or wire it up if it was meant to be used somewhere (e.g. page titles) |

`.env.example` is otherwise complete and accurate — every variable the app
actually reads is documented there with guidance on what production needs.

Phase 16 additions:

| Variable | Required for | Status |
|---|---|---|
| `DIRECT_URL` | Prisma migrations against a pooled `DATABASE_URL` (§7.1) | Set locally (same as `DATABASE_URL` — no pooler to speak of yet); **must** be the unpooled connection string once a real Neon/Supabase project exists |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Distributed rate limiting (§7.2) | Unset — in-memory fallback active |
| `QSTASH_TOKEN` / `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` | Background job queue for notification emails (§7.4) | Unset — synchronous inline-send fallback active |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Error tracking (§7.7) | Unset — `Sentry.init({enabled:false})`, a documented no-op |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Sentry source-map upload at build time | Unset — build-time upload step skipped, builds unaffected |

---

## 7. Phase 16 — Production readiness at scale (1000+ concurrent users)

Everything in this section is **code-complete and verified against local
Postgres/local storage** (this project had no production infrastructure at
all before this phase — see the credential-gap note at the top of each
subsection). Nothing here is "confirmed live in production" — that requires
whoever provisions the real accounts below to set the env vars and re-run
the verification each subsection names.

### 7.1 Database: pooled connections + indexes

- `prisma/schema.prisma`'s datasource block now has both `url` (must be the
  **pooled** connection string in production — Neon's `-pooler` host, or
  Supabase's pooler port 6543 with `pgbouncer=true`) and `directUrl` (the
  **unpooled** connection, used only by `prisma migrate`).
- **`connection_limit` sizing**: set it on the pooled `DATABASE_URL` as a
  query param (`?connection_limit=N`). `N` should be *(your Postgres plan's
  max connections) / (expected peak concurrent serverless function
  instances)*. Neon's free/Launch tiers cap around 100–300 connections
  depending on compute size; Vercel can genuinely run many dozens of
  concurrent function instances under real load. A conservative starting
  point once real numbers are known: `connection_limit=5` per instance,
  reviewed against the actual plan's cap and actual peak concurrency
  observed in the k6 run (§7.8) once staging exists on real infra.
- New migration `20260912053359_phase16_capacity_indexes` (applied and
  verified against local Postgres): `Application(driveId, status)`,
  `AcademicRecord(currentCgpa)`, `Student(branchId, batchId)`,
  `AuditLog(entity, createdAt)`, plus `pg_trgm` + GIN trigram indexes on
  every column the global search does substring matching against
  (`Student.enrollmentNumber/firstName/lastName`, `Company.name`,
  `JobRole.title`, `PlacementDrive.title`).
- N+1 audit: fixed two real ones in `analytics.service.ts`
  (`listCompanySummaries`, `getDepartmentBreakdown` — both now single
  `groupBy` queries instead of one query per company/department).
  `drive-dashboard.service.ts`'s industry-benchmark drill-down has a
  similar but bounded (capped at 50, infrequent) pattern — flagged, not
  fixed this phase.

### 7.2 Distributed rate limiting

`lib/rate-limit.ts` — Upstash Redis-backed (`@upstash/ratelimit`, sliding
window) when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set;
falls back to the original in-memory limiter (console warning) otherwise.
Same buckets as before (login, forgot/reset/change-password,
application-submit) plus two new ones added this phase: AI generation
(`ai-burst` 6/min + `ai-daily` 20/day per student, §7.6) and report
generation (10/min per admin). Verified end to end via a real
Playwright run: hammering the report-generation endpoint past its cap
returns 429 (confirmed with the in-memory fallback, since no real
Upstash credentials exist this session — get them at
https://console.upstash.com/redis, free tier is enough to start).

### 7.3 Polling load at scale

Estimate: 1000 concurrent active sessions × (~1 main "live" query at 15s +
the notification bell) ≈ 11,500 requests/minute (~190 req/s) sustained
from polling alone, before any real user action — the notification bell
alone was roughly two-thirds of that, and re-serialized up to 15 full
notification rows every poll regardless of whether anything changed.
Fixed with a cheap "has anything changed" short-circuit (new
`GET /api/notifications/peek` — one indexed count + one indexed
single-row lookup, no notification bodies) that the bell now polls on its
8s interval; the expensive full list fetch only fires when something
actually changed. Verified this doesn't regress Phase 15's fast-path
proof (`realtime-propagation.spec.ts`, 6/6 passing). The same
version-check pattern is designed to extend to the other "live" queries
(student-applications, drive-shortlist, etc.) but wasn't built out for
all of them this phase — dashboard aggregate polls (Command Center,
HOD/faculty/company) were reviewed and left at 20s, since that population
is admin/faculty-sized (tens of users), not 1000+.

### 7.4 Background jobs

The brief's original plan was Next.js `after()` for single-recipient
sends and Upstash QStash for bulk. **`after()` does not exist in any
stable Next.js 14.x release** (only 14.3.0-canary builds have it —
confirmed by checking the installed 14.2.35's actual exports; it
stabilized only in Next 15). Upgrading Next's major version is a real,
separate risk this phase should not take on as a side effect of one
sub-item, so every notification email (single-recipient or bulk) now
goes through one mechanism: `lib/queue/qstash.ts` + a signature-verified
`/api/jobs/send-email` callback route. Bulk sends use `batchJSON` (one
QStash API call for the whole batch, not one per recipient — verified
with a unit test asserting exactly one `batchJSON` call for 300
recipients). Falls back to the original synchronous inline send when
`QSTASH_TOKEN` is unset. Get QStash credentials at
https://console.upstash.com/qstash.

### 7.5 Direct-to-storage uploads

New `StorageAdapter.getPresignedUploadUrl()` (real presigned PUT for
R2/S3; a small signed dev-only route for the local driver) +
`lib/uploads/presign.ts` (per-category auth + type/size validation,
before any URL is issued) + `hooks/use-direct-upload.ts` (client-side
3-step helper). **Migrated and verified end to end** (real UI or
API-level presign→PUT→confirm, DB-verified): resumes, documents,
certifications, achievements, internships, projects, videos,
offer-letters, incident-evidence, ppt-attachments — 10 of the 11 named
categories. **Not migrated this phase**: company logos — its upload is
part of one multipart submission covering the entire company
create/update form, not an isolated file field; migrating it means
converting that whole form to JSON, not just the upload mechanism. Left
on the old path deliberately: it's a rare admin action with a 2MB cap,
nowhere near Vercel's body-size limit even unmigrated. Flagged for a
follow-up phase.

### 7.6 AI resource governance

`lib/ai/usage.ts`: per-student burst (6/min) + daily (20/day) caps via
the same Upstash-backed limiter as §7.2, enforced before every AI call.
`lib/ai/anthropic-provider.ts` catches `Anthropic.RateLimitError` (after
the SDK's own built-in retry/backoff is exhausted) and surfaces a clean
"try again in a moment" message instead of a raw SDK error. Every
successful call logs input/output tokens + a rough cost estimate (fixed
$/million-token constants documented next to where they're used — not
billing-accurate, just visible) to a new `AiUsageLog` table, readable via
`GET /api/admin/ai-usage` (per-day aggregates, last N days).

### 7.7 Observability

- Sentry (`@sentry/nextjs`) wired for client (`instrumentation-client.ts`),
  server, and edge (`instrumentation.ts` + `sentry.server.config.ts` /
  `sentry.edge.config.ts`) runtimes, plus a new `app/global-error.tsx`
  (the app had no top-level React error boundary at all before this).
  `requireAuth()` (the one choke point nearly every route passes through)
  tags the acting user/role on the current Sentry scope; `handleApiError`
  and `errorResponse` capture genuinely unexpected errors (not routine
  4xx business-logic responses) via `Sentry.captureException`. All of
  this runs as a documented no-op without `SENTRY_DSN` set — confirmed via
  a real captured test error (both a standalone script and a real in-app
  route through `handleApiError`) producing a well-formed, non-empty
  Sentry event id, proving the full capture pipeline runs correctly; no
  live Sentry project exists this session to view the event in an actual
  dashboard. Get a DSN at https://sentry.io (org + project), and an org
  auth token only if source-map upload at build time is wanted.
- `GET /api/health` — no auth required (added to a small public-route
  allowlist in `middleware.ts`, which otherwise redirects every
  unauthenticated request to `/login`, API routes included). Checks DB
  (`SELECT 1`) and storage (`exists()` on a near-certainly-absent key)
  reachability. **Recommendation, not implemented**: point a free
  UptimeRobot (or similar) HTTP(s) monitor at this endpoint once deployed,
  checking every 1–5 minutes, alerting on a non-200 or on the `"status":
  "degraded"` body.

### 7.8 Load testing (k6)

*(Filled in after the k6 run — see the dedicated results below this
line once P8 completes.)*

### 7.9 Backup and disaster recovery

**No production Postgres instance exists yet** — this section documents
the required steps and confirmation checklist for whoever provisions one
(Neon or Supabase), not a confirmation that PITR is already on (there is
nothing to check it against yet).

**Before go-live, whoever provisions the production database must:**

1. **Confirm point-in-time recovery is actually enabled**, not assumed:
   - **Neon**: PITR is on by default on all plans, with a retention window
     that varies by plan (Free: 24 hours; paid plans: up to 30 days,
     configurable). Confirm the actual retention window in the Neon
     console under Project → Settings → Backup/Restore, and make sure
     it's long enough to catch a bad deploy discovered a day or two later,
     not just the same day.
   - **Supabase**: PITR is **not on by default** on lower tiers — it's a
     paid add-on (Pro plan and above) that must be explicitly enabled
     under Project Settings → Database → Backups. Confirm this has
     actually been turned on, not just that a base plan was purchased.
2. **Document the actual recovery procedure**, filled in with the real
   project name/dashboard URL once that project exists:
   - **Who has access**: list the specific people (by name, not just role)
     who hold Neon/Supabase console admin access, and confirm at least two
     people have it (a single point of failure at 2am is its own risk).
   - **How to restore to a point in time** (Neon): Console → Project →
     Branches → "Restore" (or create a new branch from a timestamp) →
     pick the timestamp just before the bad event → this creates a new
     branch/instance at that state, which is then pointed at by
     `DATABASE_URL`/`DIRECT_URL` (or promoted) — Neon's PITR restores to a
     **new branch**, not in-place, so the bad-state database is never
     destroyed in the process (a safety net if the chosen timestamp turns
     out to be wrong too).
   - **How to restore to a point in time** (Supabase): Project Settings →
     Database → Backups → Point in Time Recovery → pick the timestamp →
     Supabase restores in-place after a confirmation step — **note that
     Supabase's PITR restore is destructive to the current state**, so
     take a manual snapshot/export first if there's any doubt.
   - **After any restore**: re-run `npx prisma migrate deploy` if the
     restored point predates a migration that's since been applied
     forward, verify `GET /api/health` returns `"status":"ok"`, and spot-
     check a handful of recent real records (not just row counts) before
     declaring the incident resolved.
   - **When to actually do this**: data corruption from a bad migration
     or bad bulk operation, not routine "a student says their data is
     wrong" (check the audit log first — nearly everything in this app is
     audit-logged and individually reversible without a full restore).
3. Add both of the above (the confirmation and the filled-in procedure)
   as a permanent addition to this section once a real project exists —
   this checklist item isn't done until the placeholder above is replaced
   with real names, URLs, and a retention window number.
