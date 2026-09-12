import { type Page, expect } from "@playwright/test";

export const PASSWORD = "Password@123";

export const ACCOUNTS = {
  studentA: { id: "E2E2021CS01", email: "e2e-student-a@iist.ac.in", role: "STUDENT" },
  studentB: { id: "E2E2021AE01", email: "e2e-student-b@iist.ac.in", role: "STUDENT" },
  faculty: { id: "e2e-faculty@iist.ac.in", email: "e2e-faculty@iist.ac.in", role: "FACULTY" },
  hodCse: { id: "hod@iist.ac.in", email: "hod@iist.ac.in", role: "HOD" },
  hodAe: { id: "hod-ae-verify@iist.ac.in", email: "hod-ae-verify@iist.ac.in", role: "HOD" },
  admin: { id: "e2e-admin@iist.ac.in", email: "e2e-admin@iist.ac.in", role: "TP_ADMIN" },
  repA: { id: "e2e-rep-a@example.com", email: "e2e-rep-a@example.com", role: "COMPANY_REP" },
  repB: { id: "e2e-rep-b@example.com", email: "e2e-rep-b@example.com", role: "COMPANY_REP" },
} as const;

/** Logs in through the real login form (not the API directly). */
export async function login(page: Page, loginId: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel(/enrollment number|email/i).fill(loginId);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log ?in/i }).click();
  // waitUntil: "commit" — the post-login redirect is a client-side
  // router.push (see login-form.tsx), not a full page navigation, so no
  // browser `load` event necessarily follows it. Waiting on the default
  // "load" lifecycle state races against that and intermittently times out
  // (seen repeatedly in CI: `waiting for navigation until "load"`), even
  // though the URL itself has already changed correctly.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15_000,
    waitUntil: "commit",
  });
}

/** Collects console errors and page errors during a page's lifetime. */
export function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

export async function expectNoConsoleErrors(errors: string[], context: string) {
  // A small, explicit allowlist for noise that isn't a real bug (e.g. a
  // favicon 404 in dev, or React DevTools hints) — extend deliberately,
  // never broadly.
  const IGNORE = [/favicon/i, /Download the React DevTools/i];
  const real = errors.filter((e) => !IGNORE.some((rx) => rx.test(e)));
  expect(real, `Console/page errors on ${context}:\n${real.join("\n")}`).toEqual([]);
}
