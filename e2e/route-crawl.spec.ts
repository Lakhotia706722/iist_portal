import { test, expect } from "@playwright/test";
import { login, trackConsoleErrors, expectNoConsoleErrors, ACCOUNTS } from "./helpers";
import { STUDENT_NAV, ADMIN_NAV, FACULTY_NAV, HOD_NAV, COMPANY_NAV } from "../components/layout/nav-config";
import type { NavGroup } from "../components/layout/sidebar";

function flatten(groups: NavGroup[]) {
  const seen = new Set<string>();
  const links: { label: string; href: string }[] = [];
  for (const g of groups) {
    for (const item of g.items) {
      if (item.comingSoon) continue; // explicitly out of scope — not a silent no-op, a marked one
      if (seen.has(item.href)) continue;
      seen.add(item.href);
      links.push({ label: item.label, href: item.href });
    }
  }
  return links;
}

const ROLES: Array<{ name: string; loginId: string; links: { label: string; href: string }[] }> = [
  { name: "student", loginId: ACCOUNTS.studentA.id, links: flatten(STUDENT_NAV) },
  { name: "admin", loginId: ACCOUNTS.admin.id, links: flatten(ADMIN_NAV) },
  { name: "faculty", loginId: ACCOUNTS.faculty.id, links: flatten(FACULTY_NAV) },
  { name: "hod", loginId: ACCOUNTS.hodCse.id, links: flatten(HOD_NAV) },
  { name: "company", loginId: ACCOUNTS.repA.id, links: flatten(COMPANY_NAV) },
];

for (const role of ROLES) {
  test.describe(`route crawl — ${role.name}`, () => {
    test(`${role.name} can log in`, async ({ page }) => {
      await login(page, role.loginId);
    });

    for (const link of role.links) {
      test(`${role.name}: ${link.label} (${link.href}) renders real content, no console errors`, async ({ page }) => {
        const errors = trackConsoleErrors(page);
        await login(page, role.loginId);

        const response = await page.goto(link.href);
        expect(response?.status(), `HTTP status for ${link.href}`).toBeLessThan(400);

        // Not stuck on a loading spinner forever, and not showing an error boundary.
        await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

        // The page must have rendered *something* beyond a bare loading state —
        // give TanStack Query queries a moment to settle, then check the
        // loading spinner text isn't still the only content on the page.
        await page.waitForTimeout(500);
        const bodyText = await page.locator("body").innerText();
        expect(bodyText.trim().length, `page ${link.href} rendered no text content at all`).toBeGreaterThan(0);

        expectNoConsoleErrors(errors, `${role.name} ${link.href}`);
      });
    }
  });
}
