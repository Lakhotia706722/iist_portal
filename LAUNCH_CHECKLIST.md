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
2. **Database** — `npx prisma migrate deploy` run clean against the real production Postgres (Neon or Supabase) from empty, then the app pointed at it with a successful login.
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
| **Rate limiting is in-memory, per-process** (`lib/rate-limit.ts`) | Simple, correct for a single instance; the `checkRateLimit()` signature is designed so swapping in Redis later doesn't require call-site changes. | Before deploying more than one Next.js server process. |
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
