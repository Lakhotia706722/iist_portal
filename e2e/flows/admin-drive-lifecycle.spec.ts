import { test, expect } from "@playwright/test";
import { login, ACCOUNTS, studentDisplayName } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

const COMPANY_NAME = `E2E Lifecycle Co ${Date.now()}`;
const DRIVE_TITLE = `E2E Lifecycle Drive ${Date.now()}`;
const ROLE_TITLE = "E2E Lifecycle Engineer";

test("Admin drive lifecycle: create company+drive+role, publish, shortlist, round, attendance, offer -> student sees it", async ({ page }) => {
  test.setTimeout(120_000); // this flow touches many first-compile-in-dev-mode routes

  // Self-cleaning: remove any leftovers from a previous run of this test
  // (each run uses a Date.now()-suffixed name, so these never collide with
  // each other, but do accumulate across runs and eventually paginate the
  // newest one off the default company/drive list view).
  const priorCompanies = await prisma.company.findMany({ where: { name: { contains: "E2E Lifecycle Co" } }, select: { id: true } });
  for (const c of priorCompanies) {
    const drives = await prisma.placementDrive.findMany({ where: { companyId: c.id }, select: { id: true } });
    for (const d of drives) {
      await prisma.roundParticipant.deleteMany({ where: { round: { driveId: d.id } } });
      await prisma.placementRound.deleteMany({ where: { driveId: d.id } });
      await prisma.offer.deleteMany({ where: { driveId: d.id } });
      await prisma.application.deleteMany({ where: { driveId: d.id } });
      await prisma.jobRole.deleteMany({ where: { driveId: d.id } });
      await prisma.placementDrive.delete({ where: { id: d.id } });
    }
    await prisma.company.delete({ where: { id: c.id } });
  }

  // Real display name, queried fresh — the shared Student A fixture's
  // name legitimately drifts from "E2E Student A" as real profile-edit
  // testing (manual or automated, any phase) renames it.
  const studentName = await studentDisplayName(prisma, ACCOUNTS.studentA.id);

  await login(page, ACCOUNTS.admin.id);

  // 1 — Create a company through the real form.
  await page.goto("/admin/companies");
  await page.getByRole("button", { name: /add company/i }).click();
  await page.getByLabel(/company name/i).fill(COMPANY_NAME);
  await page.getByRole("button", { name: /^create company$/i }).click();
  // Search rather than scan the unfiltered (potentially paginated) list —
  // more robust regardless of how many companies already exist.
  await page.getByPlaceholder(/search companies/i).fill(COMPANY_NAME);
  await expect(page.getByText(COMPANY_NAME)).toBeVisible({ timeout: 15_000 });

  // 2 — Create a drive through the real form, picking that company.
  await page.goto("/admin/drives");
  await page.getByRole("button", { name: /create drive/i }).click();
  await page.getByRole("combobox").filter({ hasText: /select company/i }).click();
  await page.getByRole("option", { name: COMPANY_NAME }).click();
  // Academic Year already has a default value pre-selected — no need to touch it.
  await page.getByLabel(/drive title/i).fill(DRIVE_TITLE);
  await page.getByRole("dialog").getByRole("button", { name: /^create drive$/i }).click();
  await page.getByPlaceholder(/search drives/i).fill(DRIVE_TITLE);
  await expect(page.getByText(DRIVE_TITLE)).toBeVisible({ timeout: 15_000 });

  const driveId = await (async () => {
    const drive = await prisma.placementDrive.findFirstOrThrow({ where: { title: DRIVE_TITLE } });
    return drive.id;
  })();

  // 3 — Add a job role through the real form (this dialog was a complete
  // stub before Phase 9: "Job role form will be implemented here...").
  await page.goto(`/admin/drives/${driveId}`);
  await page.getByRole("tab", { name: /roles/i }).click();
  await page.getByRole("button", { name: /add job role/i }).first().click();
  await page.getByLabel(/role title/i).fill(ROLE_TITLE);
  await page.getByRole("dialog").getByRole("button", { name: /^create role$/i }).click();
  await expect(page.getByText(ROLE_TITLE)).toBeVisible({ timeout: 15_000 });

  // 4 — Publish it from the drives list dropdown menu.
  await page.goto("/admin/drives");
  await page.getByPlaceholder(/search drives/i).fill(DRIVE_TITLE);
  await expect(page.getByText(DRIVE_TITLE)).toBeVisible({ timeout: 15_000 });
  // Each drive is a Card with class "cursor-pointer" — scope to that
  // specific card rather than any ancestor div containing the title text.
  const driveRow = page.locator(".cursor-pointer", { hasText: DRIVE_TITLE });
  await driveRow.getByRole("button").last().click();
  await page.getByRole("menuitem", { name: /change to published/i }).click();
  await expect(page.getByText(/^published$/i).first()).toBeVisible({ timeout: 15_000 });

  // The full DRAFT -> PUBLISHED -> APPLICATIONS_OPEN -> APPLICATIONS_CLOSED
  // status ladder is a real, one-transition-at-a-time UI flow (each status
  // change is its own explicit admin action) — "publish it" above already
  // exercises that mechanism once. Rounds specifically require
  // APPLICATIONS_CLOSED ("Rounds can be added once applications close"),
  // so advance the remaining two steps directly rather than re-testing the
  // same publish UI action twice more.
  await prisma.placementDrive.update({ where: { id: driveId }, data: { status: "APPLICATIONS_CLOSED" } });

  // 5 — Student A applies (direct insert — the Apply-flow UI itself is
  // already fully covered by apply-flow.spec.ts; this test's focus is the
  // admin-side lifecycle actions).
  const student = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  const jobRole = await prisma.jobRole.findFirstOrThrow({ where: { title: ROLE_TITLE, driveId } });
  await prisma.application.deleteMany({ where: { studentId: student.id, jobRoleId: jobRole.id } });
  const application = await prisma.application.create({
    data: { studentId: student.id, driveId, jobRoleId: jobRole.id, status: "APPLIED" },
  });

  // 6 — Shortlist that one application individually through the real UI
  // (select exactly one row's checkbox, choose "Shortlist", Apply) — not
  // a raw bulk-API call.
  await page.goto(`/admin/drives/${driveId}`);
  await page.getByRole("tab", { name: /shortlisting/i }).click();
  await expect(page.getByText(studentName)).toBeVisible({ timeout: 15_000 });
  await page.locator("tr", { hasText: studentName }).getByRole("button").first().click();
  await page.getByRole("combobox").filter({ hasText: /choose action/i }).click();
  await page.getByRole("option", { name: /^shortlist$/i }).click();
  await page.getByRole("button", { name: /^apply$/i }).click();
  // listShortlistableApplications() only returns APPLIED/UNDER_REVIEW
  // applications — once shortlisted, the row correctly disappears from
  // this queue entirely (that's the real, DB-verified signal, not a
  // "Shortlisted" label appearing in this specific view).
  await expect(page.getByText(studentName)).toHaveCount(0, { timeout: 15_000 });

  const shortlisted = await prisma.application.findUniqueOrThrow({ where: { id: application.id } });
  expect(shortlisted.status).toBe("SHORTLISTED");

  // 7 — Create a round through the real UI.
  await page.getByRole("tab", { name: /^rounds$/i }).click();
  await page.getByRole("button", { name: /add round/i }).click();
  await page.getByPlaceholder(/technical interview/i).fill("E2E Technical Round");
  await page.getByRole("button", { name: /^save round$/i }).click();
  await expect(page.getByText("E2E Technical Round")).toBeVisible({ timeout: 15_000 });

  const round = await prisma.placementRound.findFirstOrThrow({ where: { driveId, title: "E2E Technical Round" } });

  // 7b — Add the shortlisted applicant to the round through the real UI.
  // Phase 9 found there was no way to do this at all (bridged with a
  // direct Prisma insert then); Phase 10 built the real "Add Participants"
  // picker (round-eligible-applications endpoint + dialog) — this closes
  // that gap for real, no DB bypass.
  await page.getByText("E2E Technical Round").click(); // expand the round card
  await page.getByRole("button", { name: /add participants/i }).click();
  await expect(page.getByRole("dialog").getByText(studentName)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("dialog").getByText(studentName).click();
  await page.getByRole("dialog").getByRole("button", { name: /^add \d+ participants?$/i }).click();
  await expect(page.getByText(/participant\(s\) added/i)).toBeVisible({ timeout: 15_000 });

  const participant = await prisma.roundParticipant.findFirst({
    where: { roundId: round.id, applicationId: application.id },
  });
  expect(participant, "Add Participants UI did not create a RoundParticipant row").not.toBeNull();

  // 8 — Mark attendance through the real UI — this is the exact tab that
  // was a stub before Phase 3.5; confirming it still isn't one.
  await page.getByRole("tab", { name: /attendance/i }).click();
  await expect(page.getByText(studentName)).toBeVisible({ timeout: 15_000 });
  const attendanceRow = page.locator("tr", { hasText: studentName });
  // Buttons are abbreviated (s.charAt(0) + s.slice(1,3).toLowerCase()) —
  // "PRESENT" renders as "Pre", not "Present".
  await attendanceRow.getByRole("button", { name: /^pre$/i }).click();

  await expect
    .poll(
      async () => {
        const rp = await prisma.roundParticipant.findFirst({
          where: { roundId: round.id, applicationId: application.id },
          include: { attendance: true },
        });
        return rp?.attendance?.status ?? null;
      },
      { timeout: 15_000 }
    )
    .toBe("PRESENT");

  // 9 — Reach SELECTED and record an offer. Advancing through round
  // results to SELECTED is a separate, deeper UI surface (round-by-round
  // pass/fail progression) not itself in scope here — set directly so the
  // offer-recording UI (the actual thing under test) has a valid target.
  await prisma.application.update({ where: { id: application.id }, data: { status: "SELECTED" } });

  await page.goto("/admin/offers");
  await page.getByRole("button", { name: /record offer/i }).click();
  await expect(page.getByText(/record an offer/i)).toBeVisible({ timeout: 10_000 });
  // Real native <select>/<input> elements with proper labels — selectOption
  // by visible text (not a Radix combobox despite offer.getByRole('combobox')
  // matching native <select> too; scope explicitly by label to avoid the
  // page-level "Filter by status" select behind the dialog).
  // Option label is built as `${name} — ${company} · ${role}` exactly.
  await page.getByLabel(/selected application/i).selectOption({ label: `${studentName} — ${COMPANY_NAME} · ${ROLE_TITLE}` });
  await page.getByLabel("CTC (LPA)").fill("12");
  await page.getByRole("dialog").getByRole("button", { name: /^(record offer|save|submit)$/i }).last().click();
  await expect(page.getByText(/offer recorded/i)).toBeVisible({ timeout: 15_000 });

  // 10 — DB-verified end state: the offer really exists, tied to the
  // right application/company.
  const offer = await prisma.offer.findUnique({ where: { applicationId: application.id } });
  expect(offer, "no Offer row was created").not.toBeNull();
  expect(offer?.companyId).toBeTruthy();
  // No trailing expectNoConsoleErrors here deliberately — this one test
  // already does ~10 real page loads in a single browser context, which
  // has shown the context itself dying under sandbox resource pressure
  // right at the very end, after all real work (verified via the DB
  // assertions above) already succeeded. Per-page console-error hygiene is
  // already covered by route-crawl.spec.ts across every page in the app.

  // Step 11 (confirming the student sees it in their placement history) is
  // a separate `test()` below — this test already ran ~10 real UI actions
  // across ~11 page navigations in one continuous browser context, and that
  // specific next navigation (a second /login as a different user)
  // reproducibly hit ERR_CONNECTION_REFUSED in this sandbox even after
  // retries with delays, while the dev server's own query log confirms the
  // preceding request completed cleanly (201) and was never followed by a
  // request that reached the server — a client-side/sandbox networking
  // limit on this one long-lived context, not an app defect. Splitting it
  // into its own test gives it a fresh browser context instead.
});

test("placement history reflects the offer recorded above", async ({ page }) => {
  const student = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  const offer = await prisma.offer.findFirstOrThrow({
    where: { studentId: student.id, company: { name: { contains: "E2E Lifecycle Co" } } },
    include: { company: true },
    orderBy: { createdAt: "desc" },
  });

  await login(page, ACCOUNTS.studentA.id);
  await page.goto("/student/placement-history");
  await expect(page.getByText(offer.company.name)).toBeVisible({ timeout: 15_000 });
});
