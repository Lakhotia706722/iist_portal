/**
 * Local dev convenience wrapper — Phase 13.
 *
 * `npx prisma db seed` (and `npm run db:seed`) invoke this file by
 * package.json convention ("prisma": {"seed": "tsx prisma/seed.ts"}). It
 * used to contain all the seeding logic directly, mixing legitimate
 * production-safe reference data with fake demo accounts in one
 * undifferentiated script — split apart into seed-reference-data.ts
 * (production-safe) and seed-test-fixtures.ts (dev/test only, guarded)
 * below. This file just runs both, in order, for local development.
 *
 * NEVER invoke this against production — it unconditionally calls
 * seed-test-fixtures.ts. Production only ever runs seed-reference-data.ts
 * directly (see LAUNCH_CHECKLIST.md).
 */
import { execFileSync } from "node:child_process";

function run(script: string, extraArgs: string[] = []) {
  console.log(`\n▶ ${script}`);
  execFileSync("npx", ["tsx", `prisma/${script}`, ...extraArgs], { stdio: "inherit" });
}

run("seed-reference-data.ts");
run("seed-test-fixtures.ts", ["--confirm-test-only"]);
