/** Page render smoke test. Run: npx tsx scripts/verify-pages.ts [baseUrl] */
const BASE = process.argv[2] ?? "http://localhost:4010";

class Jar {
  private j = new Map<string, string>();
  absorb(r: Response) {
    for (const raw of (r.headers as any).getSetCookie?.() ?? []) {
      const [p] = raw.split(";");
      const i = p.indexOf("=");
      if (i > 0) this.j.set(p.slice(0, i).trim(), p.slice(i + 1).trim());
    }
  }
  header() {
    return [...this.j].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function login(id: string, password: string) {
  const jar = new Jar();
  const c = await fetch(`${BASE}/api/auth/csrf`);
  jar.absorb(c);
  const { csrfToken } = (await c.json()) as { csrfToken: string };
  const r = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: jar.header() },
    body: new URLSearchParams({ enrollmentNumber: id, password, csrfToken, callbackUrl: `${BASE}/dashboard` }),
    redirect: "manual",
  });
  jar.absorb(r);
  return jar;
}

async function check(jar: Jar, paths: string[]) {
  for (const p of paths) {
    const res = await fetch(BASE + p, { headers: { cookie: jar.header() }, redirect: "manual" });
    const body = res.status === 200 ? await res.text() : "";
    const broke = body.includes("must be used within");
    const good = res.status === 200 && !broke;
    if (!good) process.exitCode = 1;
    console.log(`  ${good ? "✓" : "✗"} ${p} -> ${res.status}${broke ? " (useToast provider error)" : ""}`);
  }
}

(async () => {
  console.log("\n=== Page render smoke ===\n[student]");
  await check(await login("IIST2021CS01", "Password@123"), [
    "/student/dashboard", "/student/opportunities", "/student/applications",
    "/student/placement-history", "/student/resume", "/student/profile/skills",
    "/settings", "/settings/change-password",
  ]);
  console.log("[admin]");
  await check(await login("tpadmin@iist.ac.in", "Password@123"), [
    "/admin/dashboard", "/admin/offers", "/admin/drives", "/admin/companies", "/settings",
  ]);
  console.log("[faculty]");
  await check(await login("faculty@iist.ac.in", "Password@123"), ["/faculty/dashboard", "/settings"]);
  console.log("[hod]");
  await check(await login("hod@iist.ac.in", "Password@123"), ["/hod/dashboard", "/settings"]);
  console.log("[company]");
  await check(await login("recruiter@isro.gov.in", "Password@123"), ["/company/dashboard", "/settings"]);
  console.log(process.exitCode ? "\n=== FAILURES ===\n" : "\n=== All pages render ===\n");
})();

export {};
