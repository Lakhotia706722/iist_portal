import { test, expect } from "@playwright/test";
import { login, ACCOUNTS } from "./helpers";

test("student can log in and reach the dashboard", async ({ page }) => {
  await login(page, ACCOUNTS.studentA.id);
  await expect(page).toHaveURL(/\/student\/dashboard|\/dashboard/);
});
