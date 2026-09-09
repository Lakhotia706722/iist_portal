/** Phase 5 page render smoke. Run: npx tsx scripts/verify-pages5.ts [baseUrl] */
import { makeClient, Jar } from "./_client";

const BASE = process.argv[2] ?? "http://localhost:4040";
const api = makeClient(BASE);

async function check(jar: Jar, paths: string[]) {
  for (const p of paths) {
    const r = await api.get(p, jar);
    const broke = r.status === 200 && r.text.includes("must be used within");
    const good = r.status === 200 && !broke;
    if (!good) process.exitCode = 1;
    console.log(`  ${good ? "✓" : "✗"} ${p} -> ${r.status}${broke ? " (provider error)" : ""}`);
  }
}

(async () => {
  console.log("\n=== Phase 5 page renders ===\n[student]");
  await check(await api.login("IIST2021CS01", "Password@123"), [
    "/student/ai-resume-builder",
    "/student/compliance",
  ]);
  console.log("[admin]");
  await check(await api.login("tpadmin@iist.ac.in", "Password@123"), [
    "/admin/policy",
    "/admin/compliance",
    "/admin/analytics",
    "/admin/reports",
    "/admin/audit-logs",
  ]);
  console.log("[hod]");
  await check(await api.login("hod@iist.ac.in", "Password@123"), [
    "/hod/analytics",
    "/hod/audit-logs",
  ]);
  console.log(process.exitCode ? "\n=== FAILURES ===\n" : "\n=== All pages render ===\n");
})();

export {};
