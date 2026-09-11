import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 9 — full functional verification config.
 *
 * Deliberately does NOT use Playwright's `webServer` auto-management: in
 * this environment, Playwright's "is a server already up" probe doesn't
 * reliably detect Next dev's on-demand-compiled first response in time,
 * causing it to spawn a second server and crash with EADDRINUSE. Run
 * `npm run dev -- -p 4242` (or `next dev -p 4242`) yourself first — same
 * pattern used for every other verify-*.ts script in this repo — then run
 * `npm run test:e2e`. CI wiring can revisit `webServer` separately.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // shared DB fixtures — deep-flow tests mutate state serially
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:4242",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
