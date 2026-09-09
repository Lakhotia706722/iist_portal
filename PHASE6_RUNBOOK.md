# Phase 6 Runbook — P0 / P2 / P5 (Run once credentials exist)

This is a standalone, self-contained runbook — whoever runs it (you, your
team, or Claude Code in a later session) doesn't need any prior conversation's
context, just this document and the credentials themselves. Follow it top to
bottom; each step names its exact command and what a pass looks like.

---

## Before you start

Have these ready in your `.env` (never commit this file, never paste secrets
into a shared doc/chat that isn't private):

```
STORAGE_DRIVER="s3"
AWS_ACCESS_KEY_ID=<R2 API token access key id>
AWS_SECRET_ACCESS_KEY=<R2 API token secret access key>
AWS_REGION="auto"
AWS_S3_BUCKET=<your bucket name>
AWS_ENDPOINT_URL="https://<account_id>.r2.cloudflarestorage.com"

DATABASE_URL=<real production Postgres connection string>

SMTP_HOST=<e.g. smtp.resend.com>
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER=<account>
SMTP_PASS=<password/API key>
EMAIL_FROM=<verified sender address>

ANTHROPIC_API_KEY=sk-ant-...
```

You can run this runbook with a **partial** set of these filled in — each step
below only needs its own section's variables. Skip a step whose section isn't
filled in yet and come back to it later.

---

## Step 1 — Storage (needs `AWS_*`/`STORAGE_DRIVER` vars)

1. Confirm `@aws-sdk/client-s3` is installed: `npm ls @aws-sdk/client-s3` — if
   missing, `npm install @aws-sdk/client-s3`.
2. Restart the dev server so the new env vars load.
3. Run `npx tsx scripts/verify-storage-adapter.ts` (already written — exercises
   upload/exists/download/getSignedUrl/delete against whichever
   `STORAGE_DRIVER` is currently set, for all four real upload paths: resumes,
   student-documents/certificates, offer-letters, ppt-attachments).
   - **Pass looks like:** upload succeeds, downloaded bytes match the
     original, delete removes the object, no errors (20/20 checks).
4. Real-app verification (not just the script): through the running app, as a
   logged-in student, upload a resume, a certification file, and (as admin) an
   offer letter and a PPT attachment. For each: confirm it appears in the UI,
   confirm the download link actually opens/downloads the file, and confirm
   deleting the record removes the object from the R2 bucket (check the
   Cloudflare dashboard, not just the DB).
5. **If there's real test data sitting in local storage from earlier phases:**
   run `npx tsx scripts/migrate-local-storage-to-s3.ts` (already written — walks
   `LOCAL_STORAGE_PATH`, uploads any found files to the target bucket,
   skip-if-exists). As of Phase 6, a DB scan found zero stored file keys
   anywhere in this project, so this is expected to report "nothing to
   migrate" — if it finds real files, that's new since Phase 6 and needs the
   corresponding DB rows' storage keys updated too, not just the files copied.

## Step 2 — Database (needs `DATABASE_URL`)

1. `npx prisma migrate deploy` against the real connection string.
   - **Pass looks like:** all migrations apply with no errors, exit code 0.
2. `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --exit-code`
   to confirm zero drift.
3. Point the app at this database (update `DATABASE_URL` in the real `.env`,
   not a `.env.local` override) and confirm the app boots and a login
   succeeds against it.

## Step 3 — Email (needs `SMTP_*`/`EMAIL_FROM`)

1. Trigger one real notification email — easiest path: use the
   forgot-password flow with a real email address you control, or trigger any
   of the 16 templates from Phase 4 through its normal flow (e.g., shortlist a
   test application).
2. **Pass looks like:** the email actually lands in the inbox (check spam
   folder too on first send), subject/body render correctly with template
   variables filled in (not `{{studentName}}` literally showing).
3. Confirm the admin template-override path still works against real SMTP
   (edit a template, confirm the override is what gets sent).

## Step 4 — AI (needs `ANTHROPIC_API_KEY`)

1. Restart the dev server so the key loads.
2. As a student, run the full AI Resume Builder flow: pick a target role,
   paste a real JD, generate a match score + suggestions.
   - **Pass looks like:** a match score renders with a real breakdown (not a
     503), suggestions reference only things actually in the student's
     verified profile.
3. Deliberately try to trip the traceability guard: if you can, temporarily
   edit the prompt/test data to include a JD requiring a skill the student
   doesn't have, and confirm the AI's response doesn't get inserted into the
   resume as if the student has it — the guard should drop or flag it, not
   silently pass it through.
4. Spot-check JD analysis, skill-gap analysis, and job recommendations render
   sensibly for a real student/role pair.
5. **Remove the API key again** (comment it out, restart) and confirm the
   resume-builder endpoint returns its 503 fallback cleanly rather than
   crashing — this re-confirms the earlier guard didn't regress while you
   were testing.

## Step 5 — Final staging smoke test (needs all of the above done)

Run through both full journeys once, end to end, against the real infra from
steps 1–4:

**Student journey:** register → complete profile → browse opportunities →
apply → check application tracking → (as admin, in parallel) get
shortlisted → advance through a round → get marked present → receive an
offer → see it in placement history.

**Admin journey:** create a drive → add a job role → set eligibility rules →
view applicants (with the SkillUp column) → shortlist → create rounds → mark
attendance → issue an offer → check the analytics dashboard reflects it →
generate one report export → check the audit log shows the actions taken.

**Pass looks like:** every step completes without an error, every
email/notification in the flow actually arrives, every file uploaded is
retrievable, and the data shows up correctly in admin analytics/reports
afterward.

---

## Reporting back

For whichever step(s) you complete in a given session, note: pass/fail, and
for any failure, the exact error and what you tried. You don't need to do all
5 steps in one sitting — this runbook is designed to be picked up
incrementally as credentials come in.
