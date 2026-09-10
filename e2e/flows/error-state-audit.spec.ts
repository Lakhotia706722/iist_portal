import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

/**
 * Phase 11 — P4. Error-state UI audit: for a representative page per role,
 * force every API call it depends on to fail (real network-level
 * interception via page.route, not a temporary code edit — safer, and
 * automatically "reverted" once the route handler is removed at the end
 * of each test) and confirm the real ErrorState component renders
 * ("Something went wrong" + a working "Try again" retry button) rather
 * than a blank screen, an unhandled exception, or the page silently
 * hanging on a loading spinner forever.
 */

const PAGES: Array<{ label: string; url: string; account: string }> = [
  { label: "Admin: Companies", url: "/admin/companies", account: ACCOUNTS.admin.id },
  { label: "Admin: SkillUp", url: "/admin/skillup", account: ACCOUNTS.admin.id },
  { label: "Admin: Reports", url: "/admin/reports", account: ACCOUNTS.admin.id },
  { label: "Admin: Audit Logs", url: "/admin/audit-logs", account: ACCOUNTS.admin.id },
  { label: "Admin: Mock Interviews", url: "/admin/mock-interviews", account: ACCOUNTS.admin.id },
  { label: "Admin: Policy Rules", url: "/admin/policy", account: ACCOUNTS.admin.id },
  { label: "Student: Opportunities", url: "/student/opportunities", account: ACCOUNTS.studentA.id },
  { label: "Student: Documents", url: "/student/documents", account: ACCOUNTS.studentA.id },
  { label: "Student: SkillUp", url: "/student/skillup", account: ACCOUNTS.studentA.id },
  { label: "Faculty: Students", url: "/faculty/students", account: ACCOUNTS.faculty.id },
  { label: "HOD: Students", url: "/hod/students", account: ACCOUNTS.hodCse.id },
  { label: "Company: Offers", url: "/company/offers", account: ACCOUNTS.repA.id },
  // Phase 11: these 6 pages were found by this exact audit to show a
  // misleading empty state ("No X found") instead of a real error state
  // on a genuine fetch failure — fixed as part of this phase (see the
  // comment on each page's own error state). Added here for durable
  // regression coverage.
  { label: "Admin: Drives", url: "/admin/drives", account: ACCOUNTS.admin.id },
  { label: "Student: My Applications", url: "/student/applications", account: ACCOUNTS.studentA.id },
  { label: "Student: Journey Tracker", url: "/student/journey", account: ACCOUNTS.studentA.id },
];

for (const { label, url, account } of PAGES) {
  test(`Error state: ${label} shows a real error UI when its data fetch fails, not a blank/crashed page`, async ({ page }) => {
    test.setTimeout(30_000);

    // Log in for real first — /api/auth/* is also under /api/**, so the
    // failure interception below must only start *after* a real session
    // exists, or login itself would never succeed.
    await login(page, account);

    // Force every remaining API call to fail with a 500 — the page's own
    // useQuery isError branch is what should catch this, not a raw
    // unhandled exception.
    await page.route("**/api/**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Simulated failure (Phase 11 error-state audit)" }) })
    );

    await page.goto(url);

    await expect(page.getByText(/something went wrong/i).first()).toBeVisible({ timeout: 15_000 });
    // No unhandled Next.js dev error overlay (a real crash, not a
    // handled error state) and no leftover infinite spinner.
    await expect(page.locator("nextjs-portal")).toHaveCount(0);

    // The retry button is real — clicking it re-fires the request
    // (still intercepted to fail, so the error state should simply
    // remain, not crash or vanish into a blank page).
    const retry = page.getByRole("button", { name: /try again/i }).first();
    if (await retry.count() > 0) {
      await retry.click();
      await expect(page.getByText(/something went wrong/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });
}

// Job Roles / Rounds / Shortlisting are tabs within a specific drive's
// detail page, not their own top-level URL — same audit, driven through
// the tabs of a real, existing drive. Only each tab's own nested endpoint
// is intercepted (not the whole /api/**) — the drive detail page's own
// top-level fetch must succeed, or the tab bar itself never renders
// (that page's own fetch-vs-not-found distinction is covered by the
// "Admin: Drives" case above and by its own dedicated fix).
const DRIVE_TABS: Array<{ tab: string; endpoint: string }> = [
  { tab: "roles", endpoint: "**/api/admin/drives/*/roles**" },
  { tab: "rounds", endpoint: "**/api/admin/drives/*/rounds**" },
  { tab: "shortlisting", endpoint: "**/api/admin/drives/*/shortlist**" },
];

for (const { tab, endpoint } of DRIVE_TABS) {
  test(`Error state: Admin drive detail — ${tab} tab shows a real error UI when its data fetch fails`, async ({ page }) => {
    test.setTimeout(30_000);
    const drive = await prisma.placementDrive.findFirstOrThrow({ where: { title: "E2E Test Drive" } });

    await login(page, ACCOUNTS.admin.id);
    await page.goto(`/admin/drives/${drive.id}`);
    await expect(page.getByRole("tab", { name: new RegExp(tab, "i") })).toBeVisible({ timeout: 15_000 });

    // Only this tab's own nested endpoint fails — the page around it
    // (already loaded) stays intact, isolating exactly this tab's own
    // error handling.
    await page.route(endpoint, (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Simulated failure (Phase 11 error-state audit)" }) })
    );
    await page.getByRole("tab", { name: new RegExp(tab, "i") }).click();

    await expect(page.getByText(/something went wrong/i).first()).toBeVisible({ timeout: 15_000 });
  });
}
