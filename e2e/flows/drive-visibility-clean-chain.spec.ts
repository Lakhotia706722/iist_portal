import { test, expect } from "@playwright/test";
import { login, trackConsoleErrors, expectNoConsoleErrors, ACCOUNTS, fillRequiredDriveDates } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

const RUN = Date.now();
const COMPANY_NAME = `P2 Chain Co ${RUN}`;
const DRIVE_TITLE = `P2 Chain Drive ${RUN}`;
const ROLE_TITLE = "P2 Chain Engineer";

/**
 * Phase 18 P2 — a real report ("published drive, 0 job roles, Applications
 * Open date of tomorrow — nothing shows to students") turned out to be two
 * separate, confirmed root causes plus one bug this test's own setup
 * exposed: listActiveOpportunities() never checked applicationOpenAt at
 * all (fixed), and drive-form.tsx's date pickers disabled "today" for the
 * entire rest of the day (fixed).
 *
 * Phase 19 — the actual architecture behind that report: "applications
 * open" was a distinct, manually-clicked DriveStatus
 * (PUBLISHED -> APPLICATIONS_OPEN -> APPLICATIONS_CLOSED), completely
 * disconnected from the dates already on the drive — an auto-close job
 * that would have derived APPLICATIONS_CLOSED from the close date existed
 * in application.service.ts but was never wired to run anywhere, and
 * nothing derived the open side at all. Removed the manual step entirely:
 * PUBLISHED is now the only state, and whether it's actually accepting
 * applications is computed live from applicationOpenAt/applicationCloseAt
 * everywhere it's checked (lib/drive-status.ts). This test proves the
 * real fix: company -> drive (opens TODAY) -> job role -> publish through
 * the one remaining manual step -> a real student sees it, searches for
 * it, and completes the real apply flow — zero manual DB intervention
 * beyond fixture cleanup.
 *
 * Split into two test()s at the admin->student handoff: admin-drive-
 * lifecycle.spec.ts already documented that a second /login as a
 * different user, deep into one long-lived browser context after many
 * prior navigations, is unreliable in this specific sandbox (not an app
 * defect) — a fresh Playwright test() gets a fresh context, which is the
 * same fix applied there.
 */
test("Full chain (1/2): company -> drive (opens today) -> role -> publish, no visibility problem remains", async ({ page }) => {
  test.setTimeout(60_000);

  await prisma.company.deleteMany({ where: { name: COMPANY_NAME } });
  const studentForCleanup = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });
  await prisma.application.deleteMany({ where: { studentId: studentForCleanup.id, jobRole: { title: ROLE_TITLE } } });

  const errors = trackConsoleErrors(page);
  await login(page, ACCOUNTS.admin.id);

  // 1 — Create a company through the real form.
  await page.goto("/admin/companies");
  await page.getByRole("button", { name: /add company/i }).click();
  await page.getByLabel(/company name/i).fill(COMPANY_NAME);
  await page.getByRole("button", { name: /^create company$/i }).click();
  await page.getByPlaceholder(/search companies/i).fill(COMPANY_NAME);
  await expect(page.getByText(COMPANY_NAME)).toBeVisible({ timeout: 15_000 });

  // 2 — Create a drive, opening TODAY (not tomorrow — the exact scenario
  // the original report's own isolation test calls for; only possible
  // through the real UI now that "today" isn't disabled anymore).
  await page.goto("/admin/drives");
  await page.getByRole("button", { name: /create drive/i }).click();
  await page.getByRole("combobox").filter({ hasText: /select company/i }).click();
  await page.getByRole("option", { name: COMPANY_NAME }).click();
  await page.getByLabel(/drive title/i).fill(DRIVE_TITLE);
  await fillRequiredDriveDates(page); // opens today, closes in the future
  await page.getByRole("dialog").getByRole("button", { name: /^create drive$/i }).click();
  await page.getByPlaceholder(/search drives/i).fill(DRIVE_TITLE);
  await expect(page.getByText(DRIVE_TITLE)).toBeVisible({ timeout: 15_000 });

  const drive = await prisma.placementDrive.findFirstOrThrow({ where: { title: DRIVE_TITLE } });

  // 3 — Add a job role through the real form (a drive with zero roles is
  // blocked from publishing at all — covered separately below).
  await page.goto(`/admin/drives/${drive.id}`);
  await page.getByRole("tab", { name: /roles/i }).click();
  await page.getByRole("button", { name: /add job role/i }).first().click();
  await page.getByLabel(/role title/i).fill(ROLE_TITLE);
  await page.getByRole("dialog").getByRole("button", { name: /^create role$/i }).click();
  await expect(page.getByText(ROLE_TITLE)).toBeVisible({ timeout: 15_000 });

  // 4 — Publish through the one real manual step. No second "Applications
  // Open" click exists anymore — the badge itself immediately reflects
  // "Applications Open" because today is within the drive's real window.
  await page.goto("/admin/drives");
  await page.getByPlaceholder(/search drives/i).fill(DRIVE_TITLE);
  await expect(page.getByText(DRIVE_TITLE)).toBeVisible({ timeout: 15_000 });
  const driveRow = page.locator(".cursor-pointer", { hasText: DRIVE_TITLE });
  await driveRow.getByRole("button").last().click();
  await page.getByRole("menuitem", { name: /change to published/i }).click();
  await expect(driveRow.getByText(/^applications open$/i)).toBeVisible({ timeout: 15_000 });

  // 5 — Admin overview shows no visibility problem — the derived state is
  // "currently open," an informational message, not a warning.
  await page.goto(`/admin/drives/${drive.id}`);
  await expect(page.getByText(/applications are currently open/i)).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByText(/open in \d|has no active job roles|still a draft/i)
  ).toHaveCount(0);

  expectNoConsoleErrors(errors, "drive visibility clean chain (admin half)");
});

test("Full chain (2/2): a real student sees it, searches for it, and completes the real apply flow", async ({ page }) => {
  test.setTimeout(60_000);
  const drive = await prisma.placementDrive.findFirstOrThrow({ where: { title: DRIVE_TITLE } });
  const student = await prisma.student.findUniqueOrThrow({ where: { enrollmentNumber: ACCOUNTS.studentA.id } });

  const errors = trackConsoleErrors(page);
  await login(page, ACCOUNTS.studentA.id);
  await page.goto("/student/opportunities");
  await page.getByPlaceholder(/search opportunities/i).fill(DRIVE_TITLE);
  await expect(page.getByText(DRIVE_TITLE)).toBeVisible({ timeout: 15_000 });

  // Real apply flow end to end (same steps as apply-flow.spec.ts). Only
  // the "View Details & Apply" link actually navigates — the card's title
  // text itself isn't wrapped in a link (confirmed in opportunity-card.tsx).
  await page.locator(`a[href="/student/opportunities/${drive.id}"]`).click();
  await page.waitForURL(`**/student/opportunities/${drive.id}`, { timeout: 15_000 });
  await expect(page.getByText(/eligible/i).first()).toBeVisible({ timeout: 15_000 });

  const applyButton = page.getByRole("button", { name: /^apply/i }).first();
  await expect(applyButton).toBeEnabled({ timeout: 10_000 });
  await applyButton.click();

  await expect(page.getByText(/you are eligible/i)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /^continue$/i }).click();

  await expect(page.getByText(/select.*resume|choose.*resume/i).first()).toBeVisible({ timeout: 10_000 });
  const resumeOption = page.locator('input[type="radio"], [role="radio"]').first();
  if (await resumeOption.count() > 0) {
    await resumeOption.click();
  } else {
    await page.getByText(/e2e resume/i).first().click();
  }
  await page.getByRole("button", { name: /^continue$/i }).click();

  await expect(page.getByText(/confirm application/i)).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /submit application/i }).click();
  // handleApplicationSuccess() (opportunity-detail-content.tsx) just closes
  // the modal and toasts — it never navigates, so waiting on a URL match
  // here would resolve immediately against the page we're already on
  // (a real race: the DB check below could then run before the submit
  // actually committed). The toast is the real completion signal.
  await expect(page.getByText(/application submitted/i)).toBeVisible({ timeout: 15_000 });

  // DB-verified end state.
  const application = await prisma.application.findFirst({
    where: { studentId: student.id, jobRoleId: { in: (await prisma.jobRole.findMany({ where: { driveId: drive.id }, select: { id: true } })).map((r) => r.id) } },
  });
  expect(application, "no Application row was created").not.toBeNull();
  expect(application?.status).toBe("APPLIED");

  expectNoConsoleErrors(errors, "drive visibility clean chain (student half)");

  // Cleanup
  await prisma.application.deleteMany({ where: { driveId: drive.id } });
  await prisma.jobRole.deleteMany({ where: { driveId: drive.id } });
  await prisma.placementDrive.delete({ where: { id: drive.id } });
  await prisma.company.deleteMany({ where: { name: COMPANY_NAME } });
});

test("Publishing with zero job roles is blocked with a visible reason, becomes enabled the moment a role is added", async ({ page }) => {
  const COMPANY = `P2 ZeroRole Co ${RUN}`;
  const DRIVE = `P2 ZeroRole Drive ${RUN}`;
  await prisma.company.deleteMany({ where: { name: COMPANY } });

  await login(page, ACCOUNTS.admin.id);
  await page.goto("/admin/companies");
  await page.getByRole("button", { name: /add company/i }).click();
  await page.getByLabel(/company name/i).fill(COMPANY);
  await page.getByRole("button", { name: /^create company$/i }).click();
  await page.getByPlaceholder(/search companies/i).fill(COMPANY);
  await expect(page.getByText(COMPANY)).toBeVisible({ timeout: 15_000 });

  await page.goto("/admin/drives");
  await page.getByRole("button", { name: /create drive/i }).click();
  await page.getByRole("combobox").filter({ hasText: /select company/i }).click();
  await page.getByRole("option", { name: COMPANY }).click();
  await page.getByLabel(/drive title/i).fill(DRIVE);
  await fillRequiredDriveDates(page);
  await page.getByRole("dialog").getByRole("button", { name: /^create drive$/i }).click();
  await page.getByPlaceholder(/search drives/i).fill(DRIVE);
  await expect(page.getByText(DRIVE)).toBeVisible({ timeout: 15_000 });

  const drive = await prisma.placementDrive.findFirstOrThrow({ where: { title: DRIVE } });

  // The "Change to Published" menu item is disabled with a visible reason
  // (a title/tooltip) — not silently blocked.
  const driveRow = page.locator(".cursor-pointer", { hasText: DRIVE });
  await driveRow.getByRole("button").last().click();
  const publishItem = page.getByRole("menuitem", { name: /change to published/i });
  await expect(publishItem).toBeDisabled();
  await expect(publishItem).toHaveAttribute("title", /add at least one job role/i);

  // Belt-and-suspenders: the API itself refuses the transition even if
  // called directly, not just a client-side-only guard.
  const res = await page.request.put(`/api/admin/drives/${drive.id}?action=update-status`, {
    data: { status: "PUBLISHED" },
  });
  expect(res.ok()).toBe(false);
  const body = await res.json();
  expect(body.error).toMatch(/job role/i);

  // The drive Overview tab shows the same reason as an explicit checklist.
  await page.goto(`/admin/drives/${drive.id}`);
  await expect(page.getByText(/still a draft/i)).toBeVisible();
  await expect(page.getByText(/add at least one active job role/i)).toBeVisible();

  // Add a role through the real UI — no manual reload anywhere below.
  await page.getByRole("tab", { name: /roles/i }).click();
  await page.getByRole("button", { name: /add job role/i }).first().click();
  await page.getByLabel(/role title/i).fill("ZeroRole Fixed Engineer");
  await page.getByRole("dialog").getByRole("button", { name: /^create role$/i }).click();
  await expect(page.getByText("ZeroRole Fixed Engineer")).toBeVisible({ timeout: 15_000 });

  // Overview tab's checklist flips live: no unmet conditions left, so it
  // collapses to the "ready" message instead of listing anything.
  await page.getByRole("tab", { name: /overview/i }).click();
  await expect(page.getByText(/ready to publish/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/add at least one active job role/i)).toHaveCount(0);

  // Back on the drives list (a real navigation, not a page.reload()), the
  // menu item is enabled now — proving the earlier disabled state wasn't
  // stuck on stale data. One publish click and the badge already reads
  // "Applications Open" (the drive's dates are already in-window) —
  // there's no separate second step to take anymore.
  await page.goto("/admin/drives");
  await page.getByPlaceholder(/search drives/i).fill(DRIVE);
  await expect(page.getByText(DRIVE)).toBeVisible({ timeout: 15_000 });
  await driveRow.getByRole("button").last().click();
  await expect(page.getByRole("menuitem", { name: /change to published/i })).toBeEnabled();
  await page.getByRole("menuitem", { name: /change to published/i }).click();
  await expect(driveRow.getByText(/^applications open$/i)).toBeVisible({ timeout: 15_000 });

  await prisma.jobRole.deleteMany({ where: { driveId: drive.id } });
  await prisma.placementDrive.delete({ where: { id: drive.id } });
  await prisma.company.deleteMany({ where: { name: COMPANY } });
});

/**
 * Phase 19 Step 4 — the three real states a PUBLISHED drive's application
 * window can be in, each verified against the real UI (badge text, the
 * admin overview's informational message, the student detail page's own
 * messaging, and the actual apply gate) rather than just the underlying
 * date-comparison logic in isolation.
 */
test.describe("Application window: the three real states of a PUBLISHED drive", () => {
  async function makePublishedDrive(opts: { title: string; slug: string; applicationOpenAt: Date; applicationCloseAt: Date }) {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "TP_ADMIN" } });
    const company = await prisma.company.upsert({
      where: { slug: opts.slug },
      update: { isActive: true },
      create: { name: `${opts.title} Co`, slug: opts.slug, industry: "TECHNOLOGY", isActive: true },
    });
    const drive = await prisma.placementDrive.create({
      data: {
        companyId: company.id,
        createdById: admin.id,
        title: opts.title,
        academicYear: "2025-2026",
        status: "PUBLISHED", // Phase 19: PUBLISHED is the only "live" status now.
        applicationOpenAt: opts.applicationOpenAt,
        applicationCloseAt: opts.applicationCloseAt,
        workMode: "ONSITE",
      },
    });
    await prisma.jobRole.create({ data: { driveId: drive.id, title: "State Test Role", isActive: true } });
    return { drive, company };
  }

  test("Not open yet: hidden from the list, detail page explains it, apply is rejected", async ({ page }) => {
    const { drive, company } = await makePublishedDrive({
      title: `P19 Future ${RUN}`,
      slug: `p19-future-${RUN}`,
      applicationOpenAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
      applicationCloseAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await login(page, ACCOUNTS.studentA.id);

    // Hidden from the real Opportunities list.
    await page.goto("/student/opportunities");
    await page.getByPlaceholder(/search opportunities/i).fill(drive.title);
    await expect(page.getByText(drive.title)).toHaveCount(0);

    // Reachable via a direct link (a real, if unusual, path — e.g. a
    // shared URL) — the detail page explains why Apply isn't available,
    // it doesn't just silently omit the button or say nothing.
    await page.goto(`/student/opportunities/${drive.id}`);
    await expect(page.getByText(/not open yet/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /not open yet/i })).toBeDisabled();

    // Enforcement gate, not just a UI nicety.
    const res = await page.request.post("/api/student/applications", {
      data: { jobRoleId: (await prisma.jobRole.findFirstOrThrow({ where: { driveId: drive.id } })).id, confirmed: true },
    });
    expect(res.ok()).toBe(false);

    await prisma.jobRole.deleteMany({ where: { driveId: drive.id } });
    await prisma.placementDrive.delete({ where: { id: drive.id } });
    await prisma.company.deleteMany({ where: { id: company.id } });
  });

  // Split at the admin->student handoff — same pre-existing sandbox
  // limitation documented in admin-drive-lifecycle.spec.ts (a second
  // /login as a different user deep in one long-lived context), not an
  // app defect. A fresh test() gets a fresh context.
  test("Currently open (1/2): admin overview shows the accurate informational message", async ({ page }) => {
    const { drive } = await makePublishedDrive({
      title: `P19 Open ${RUN}`,
      slug: `p19-open-${RUN}`,
      applicationOpenAt: new Date(Date.now() - 60 * 60 * 1000), // an hour ago
      applicationCloseAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await login(page, ACCOUNTS.admin.id);
    await page.goto(`/admin/drives/${drive.id}`);
    await expect(page.getByText(/applications are currently open/i)).toBeVisible({ timeout: 15_000 });
  });

  test("Currently open (2/2): visible, searchable, and appliable by a real student", async ({ page }) => {
    const drive = await prisma.placementDrive.findFirstOrThrow({ where: { title: `P19 Open ${RUN}` } });

    await login(page, ACCOUNTS.studentA.id);
    await page.goto("/student/opportunities");
    await page.getByPlaceholder(/search opportunities/i).fill(drive.title);
    // The company name is "<drive title> Co" — getByText(drive.title)
    // would ambiguously match both the card's title and that company
    // name. The title renders as a heading; scope to that specifically.
    await expect(page.getByRole("heading", { name: drive.title })).toBeVisible({ timeout: 15_000 });

    await page.locator(`a[href="/student/opportunities/${drive.id}"]`).click();
    await page.waitForURL(`**/student/opportunities/${drive.id}`, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: /^apply/i }).first()).toBeEnabled({ timeout: 10_000 });

    await prisma.jobRole.deleteMany({ where: { driveId: drive.id } });
    await prisma.placementDrive.delete({ where: { id: drive.id } });
    await prisma.company.deleteMany({ where: { id: drive.companyId } });
  });

  test("Closed: hidden from the list, detail page shows closed, apply is rejected", async ({ page }) => {
    const { drive, company } = await makePublishedDrive({
      title: `P19 Closed ${RUN}`,
      slug: `p19-closed-${RUN}`,
      applicationOpenAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      applicationCloseAt: new Date(Date.now() - 60 * 60 * 1000), // an hour ago
    });

    await login(page, ACCOUNTS.studentA.id);

    await page.goto("/student/opportunities");
    await page.getByPlaceholder(/search opportunities/i).fill(drive.title);
    await expect(page.getByText(drive.title)).toHaveCount(0);

    await page.goto(`/student/opportunities/${drive.id}`);
    await expect(page.getByText(/applications closed/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /applications closed/i })).toBeDisabled();

    const res = await page.request.post("/api/student/applications", {
      data: { jobRoleId: (await prisma.jobRole.findFirstOrThrow({ where: { driveId: drive.id } })).id, confirmed: true },
    });
    expect(res.ok()).toBe(false);

    await prisma.jobRole.deleteMany({ where: { driveId: drive.id } });
    await prisma.placementDrive.delete({ where: { id: drive.id } });
    await prisma.company.deleteMany({ where: { id: company.id } });
  });
});
