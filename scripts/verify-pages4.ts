/** Phase 4 page render smoke. Run: npx tsx scripts/verify-pages4.ts [baseUrl] */
import { makeClient, ok, fail, Jar } from "./_client";

const BASE = process.argv[2] ?? "http://localhost:4030";
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
  console.log("\n=== Phase 4 page renders ===\n[student]");
  await check(await api.login("IIST2021CS01", "Password@123"), [
    "/student/skillup",
    "/student/mock-interviews",
    "/student/notifications",
    "/student/calendar",
    "/student/dashboard",
  ]);
  console.log("[admin]");
  await check(await api.login("tpadmin@iist.ac.in", "Password@123"), [
    "/admin/skillup",
    "/admin/mock-interviews",
    "/admin/notifications",
    "/admin/calendar",
    "/admin/documents",
    "/admin/drives/p0-verify-drive",
  ]);
  console.log("[faculty]");
  await check(await api.login("faculty@iist.ac.in", "Password@123"), [
    "/faculty/skillup",
    "/faculty/mock-interviews",
    "/notifications",
  ]);
  console.log(process.exitCode ? "\n=== FAILURES ===\n" : "\n=== All pages render ===\n");
})();

export {};
