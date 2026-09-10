import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "../helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

/**
 * Phase 11 — P1.3. Unauthorized attempts through the real UI (direct URL
 * navigation and a manipulated direct API call), for the two role
 * boundaries Phase 10's portal-isolation-url.spec.ts didn't cover yet
 * (that one did HOD and Company-Rep cross-tenant access) — Student and
 * Faculty.
 */

test("Student cannot reach admin, faculty, hod or company portals via direct URL", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page, ACCOUNTS.studentA.id);

  for (const url of ["/admin/dashboard", "/faculty/dashboard", "/hod/dashboard", "/company/dashboard"]) {
    await page.goto(url);
    await page.waitForURL((u) => u.pathname === "/unauthorized", { timeout: 15_000 });
  }
});

test("Faculty cannot reach the admin portal via direct URL", async ({ page }) => {
  await login(page, ACCOUNTS.faculty.id);
  await page.goto("/admin/dashboard");
  await page.waitForURL((u) => u.pathname === "/unauthorized", { timeout: 15_000 });
});

test("Faculty cannot perform a T&P-admin-only action via a direct, manipulated API call", async ({ page }) => {
  test.setTimeout(60_000);
  const companyName = `E2E Unauthorized Faculty Co ${Date.now()}`;
  await prisma.company.deleteMany({ where: { name: companyName } });

  // A real logged-in Faculty session, bypassing the UI entirely (no "Add
  // company" button exists on their own portal) and hitting the admin API
  // route directly with a crafted request — the same thing a user with
  // dev tools open could do.
  await login(page, ACCOUNTS.faculty.id);
  const form = new URLSearchParams({ name: companyName, slug: `e2e-unauth-fac-${Date.now()}`, industry: "TECHNOLOGY" });
  const res = await page.request.post("/api/admin/companies", {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    data: form.toString(),
  });
  expect(res.status()).toBe(403);

  const created = await prisma.company.findFirst({ where: { name: companyName } });
  expect(created, "a T&P-admin-only action succeeded for a Faculty session").toBeNull();
});

test("Student cannot perform an admin-only action via a direct, manipulated API call", async ({ page }) => {
  test.setTimeout(60_000);
  await login(page, ACCOUNTS.studentA.id);
  const res = await page.request.get("/api/admin/audit-logs");
  expect(res.status()).toBe(403);
});
