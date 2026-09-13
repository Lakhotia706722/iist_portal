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

// TEMPORARY — CI login-timeout investigation, gated off by default. See
// matching notes in lib/auth/auth.ts, lib/auth/auth.config.ts and
// components/auth/login-form.tsx.
const DEBUG_AUTH_TIMING = process.env.DEBUG_AUTH_TIMING === "true";

/** Logs in through the real login form (not the API directly). */
export async function login(page: Page, loginId: string, password = PASSWORD) {
  if (DEBUG_AUTH_TIMING) {
    // Forward the browser's own [AUTH_TIMING] client-side logs into the
    // Node/CI output so both halves land in the same log stream.
    page.on("console", (msg) => {
      if (msg.text().includes("[AUTH_TIMING]")) console.log(msg.text());
    });
  }

  await page.goto("/login");
  await page.getByLabel(/enrollment number|email/i).fill(loginId);
  await page.getByLabel(/^password/i).fill(password);

  const t0 = DEBUG_AUTH_TIMING ? performance.now() : 0;
  await page.getByRole("button", { name: /sign in|log ?in/i }).click();
  try {
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
  } finally {
    if (DEBUG_AUTH_TIMING) {
      console.log(`[AUTH_TIMING] click-to-redirect (login: ${loginId}): ${(performance.now() - t0).toFixed(1)}ms`);
    }
  }
}

/**
 * Phase 17 P3: application opening/closing dates are required fields on
 * the real "Create Drive" form. Each date field's trigger button's
 * accessible name is its FormLabel text (e.g. "Application Opens *"), not
 * its "Pick a date" inner text — confirmed via an aria snapshot of the
 * real dialog. Always navigates one month ahead before picking a day so
 * the choice is never accidentally in the past (disabled by the real
 * Calendar component), regardless of what day of the month the suite
 * runs on.
 */
export async function pickFutureDate(page: Page, fieldLabel: string, day: string) {
  await page.getByRole("button", { name: fieldLabel }).click();
  await page.getByRole("button", { name: "Go to the Next Month" }).click();
  await page.getByRole("gridcell").filter({ hasText: new RegExp(`^${day}$`) }).getByRole("button").click();
}

/**
 * Phase 18 P2: picks today's date without navigating months — today used
 * to be disabled by the same Calendar component pickFutureDate works
 * around (fixed in drive-form.tsx's isBeforeToday), so this is now safe.
 * Targets today's actual rendered accessible name, confirmed by dumping
 * the real dialog's DOM: react-day-picker v9 gives today's cell an
 * aria-label of "Today, <full date>" (e.g. "Today, Sunday, September
 * 13th, 2026") — every other day's label omits the "Today, " prefix. Two
 * earlier guesses (`[aria-current="date"]`, a permanent `bg-accent`
 * class) both failed against the real DOM before landing on this.
 */
export async function pickTodayDate(page: Page, fieldLabel: string) {
  await page.getByRole("button", { name: fieldLabel }).click();
  await page.getByRole("button", { name: /^today,/i }).click();
}

/** Fills the two required drive dates on an already-open "Create Drive" dialog: opens today, closes in the future. */
export async function fillRequiredDriveDates(page: Page) {
  await pickTodayDate(page, "Application Opens *");
  await pickFutureDate(page, "Application Closes *", "20");
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
