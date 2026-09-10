/**
 * Phase 11 — P3 data-volume verification.
 *
 * Run scripts/seed-volume.ts first. Measures real wall-clock times against
 * the volume dataset it creates (220 students, a drive with 120
 * applications, 3,000 audit-log rows) — pagination correctness, report
 * export timing, search/audit-log responsiveness, and analytics
 * aggregation timing.
 *
 * Run: npx tsx scripts/verify-volume.ts [baseUrl]
 */
import { makeClient, ok, fail } from "./_client";
import { prisma } from "../lib/prisma";

const BASE = process.argv[2] ?? "http://localhost:4242";

async function timed<T>(label: string, fn: () => Promise<T>): Promise<{ ms: number; result: T }> {
  const start = Date.now();
  const result = await fn();
  const ms = Date.now() - start;
  console.log(`    (${label}: ${ms}ms)`);
  return { ms, result };
}

async function main() {
  console.log(`=== Data-volume verification against ${BASE} ===\n`);

  const api = makeClient(BASE);
  const admin = await prisma.user.findFirstOrThrow({ where: { email: "e2e-admin@iist.ac.in" } });
  const jar = await api.login("e2e-admin@iist.ac.in", "Password@123");
  if (!jar.has("session-token")) {
    fail("admin login failed — run seed-e2e.ts first");
    return;
  }

  const drive = await prisma.placementDrive.findFirstOrThrow({ where: { title: "E2E Volume Drive" } });

  console.log("[1] Shortlist table pagination (120 applications on one drive)");
  {
    const { ms, result: page1 } = await timed("page 1 (limit=100, offset=0)", () =>
      api.get(`/api/admin/drives/${drive.id}/shortlist?limit=100&offset=0`, jar)
    );
    if (page1.status === 200 && page1.json.applications.length === 100 && page1.json.pagination.total === 120) {
      ok(`page 1 returns exactly 100 rows, total=120 (${ms}ms)`);
    } else {
      fail(`page 1: expected 100 rows/total=120, got ${page1.json.applications?.length} rows/total=${page1.json.pagination?.total}`);
    }

    const { result: page2 } = await timed("page 2 (limit=100, offset=100)", () =>
      api.get(`/api/admin/drives/${drive.id}/shortlist?limit=100&offset=100`, jar)
    );
    if (page2.status === 200 && page2.json.applications.length === 20) {
      ok("page 2 returns the remaining 20 rows");
    } else {
      fail(`page 2: expected 20 rows, got ${page2.json.applications?.length}`);
    }

    const page1Ids = new Set(page1.json.applications.map((a: any) => a.id));
    const overlap = page2.json.applications.filter((a: any) => page1Ids.has(a.id));
    overlap.length === 0
      ? ok("no overlap between page 1 and page 2 (real pagination, not a re-shuffled duplicate window)")
      : fail(`${overlap.length} row(s) appeared on both pages`);
  }

  console.log("\n[2] Report export timing (220+ students)");
  {
    for (const format of ["csv", "xlsx", "pdf"] as const) {
      const { ms, result } = await timed(format, () => api.get(`/api/admin/reports/students?format=${format}`, jar));
      if (result.status === 200) {
        ok(`students report (${format}): ${ms}ms, ${result.text.length} bytes`);
        if (ms > 10_000) fail(`students report (${format}) took ${ms}ms — that's slow enough to be worth investigating`);
      } else {
        fail(`students report (${format}) returned ${result.status}`);
      }
    }
  }

  console.log("\n[3] Global search responsiveness");
  {
    const { ms, result } = await timed("search 'E2E Volume'", () => api.get(`/api/admin/search?q=E2E+Volume`, jar));
    result.status === 200 ? ok(`search returns 200 in ${ms}ms (${result.json.results?.length ?? 0} results)`) : fail(`search returned ${result.status}`);
    if (ms > 3000) fail(`search took ${ms}ms against 220+ students — slower than expected`);
  }

  console.log("\n[4] Audit log viewer responsiveness (3,000+ rows)");
  {
    const { ms, result } = await timed("list first page", () => api.get(`/api/admin/audit-logs?limit=30&offset=0`, jar));
    result.status === 200 ? ok(`audit log list returns 200 in ${ms}ms (total=${result.json.total})`) : fail(`audit log list returned ${result.status}`);
    if (ms > 3000) fail(`audit log list took ${ms}ms with ${result.json.total} rows — slower than expected`);

    const { ms: filterMs, result: filtered } = await timed("filtered by entity", () => api.get(`/api/admin/audit-logs?entity=Application&limit=30`, jar));
    filtered.status === 200 ? ok(`entity-filtered audit log query: ${filterMs}ms`) : fail(`filtered audit log query returned ${filtered.status}`);
  }

  console.log("\n[5] Analytics aggregation timing");
  {
    const { ms, result } = await timed("command center", () => api.get(`/api/admin/analytics/command-center`, jar));
    result.status === 200 ? ok(`analytics command center: ${ms}ms (${result.json.students?.total} students)`) : fail(`analytics command center returned ${result.status}`);
    if (ms > 5000) fail(`analytics command center took ${ms}ms — slower than expected at this volume`);

    const { ms: deptMs, result: dept } = await timed("department breakdown", () => api.get(`/api/admin/analytics/department`, jar));
    dept.status === 200 ? ok(`department analytics: ${deptMs}ms`) : fail(`department analytics returned ${dept.status}`);
  }

  console.log("\n=== Data-volume verification complete ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
