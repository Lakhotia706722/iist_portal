/**
 * HTTP-level verification against a running dev server.
 * Run: npx tsx scripts/verify-http.ts [baseUrl]
 */

const BASE = process.argv[2] ?? "http://localhost:3999";

const ok = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string) => {
  console.error(`  ✗ ${m}`);
  process.exitCode = 1;
};

/** Minimal cookie jar. */
class Jar {
  private jar = new Map<string, string>();
  absorb(res: Response) {
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const idx = pair.indexOf("=");
      if (idx > 0) this.jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
  }
  header() {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  has(fragment: string) {
    return [...this.jar.keys()].some((k) => k.includes(fragment));
  }
}

async function login(id: string, password: string) {
  const jar = new Jar();

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  jar.absorb(csrfRes);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie: jar.header(),
    },
    body: new URLSearchParams({
      enrollmentNumber: id,
      password,
      csrfToken,
      callbackUrl: `${BASE}/dashboard`,
    }),
    redirect: "manual",
  });
  jar.absorb(res);
  return jar;
}

async function get(path: string, jar: Jar) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: jar.header() },
    redirect: "manual",
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, json, text };
}

async function main() {
  console.log(`\n=== HTTP verification against ${BASE} ===\n`);

  console.log("[1] Student login");
  const student = await login("IIST2021CS01", "Password@123");
  student.has("session-token")
    ? ok("student session cookie issued")
    : fail("student login failed (no session cookie)");

  console.log("\n[2] Opportunity detail eligibility (the P0.1 bug)");
  const list = await get("/api/student/opportunities", student);
  if (list.status !== 200) {
    fail(`opportunities list returned ${list.status}: ${list.text.slice(0, 200)}`);
  } else {
    const items =
      list.json?.opportunities ?? list.json?.drives ?? list.json?.items ?? [];
    ok(`opportunities list 200 (${items.length} item(s))`);

    const target =
      items.find((d: any) => d.title === "Verification Drive") ?? items[0];
    if (!target) {
      fail("no opportunity available to test detail eligibility");
    } else {
      const detail = await get(
        `/api/student/opportunities/${target.id}?checkEligibility=true`,
        student
      );
      if (detail.status !== 200) {
        fail(`detail returned ${detail.status}: ${detail.text.slice(0, 300)}`);
      } else {
        const elig = detail.json?.eligibility ?? detail.json?.eligibilityResults ?? {};
        const entries = Object.entries<any>(elig);
        ok(`detail 200, eligibility computed for ${entries.length} role(s)`);

        const systemErrors = entries.filter(([, v]) =>
          (v?.results ?? []).some((r: any) => r.field === "system")
        );
        systemErrors.length === 0
          ? ok('no "System Error" results — eligibility evaluates correctly')
          : fail(`${systemErrors.length} role(s) still returning System Error`);

        for (const [roleId, v] of entries) {
          console.log(
            `      role ${roleId}: eligible=${v?.eligible} rules=${(v?.results ?? [])
              .map((r: any) => `${r.field}:${r.passed ? "pass" : "fail"}`)
              .join(", ")}`
          );
        }
      }
    }
  }

  console.log("\n[3] Student placement history");
  const hist = await get("/api/student/offers", student);
  hist.status === 200
    ? ok(`/api/student/offers 200 — ${hist.json?.offers?.length ?? 0} offer(s)`)
    : fail(`/api/student/offers returned ${hist.status}: ${hist.text.slice(0, 200)}`);

  console.log("\n[4] Authorization: student must not reach admin offer APIs");
  const forbidden = await get("/api/admin/offers", student);
  forbidden.status === 403
    ? ok("student -> /api/admin/offers returns 403")
    : fail(`expected 403, got ${forbidden.status}`);

  console.log("\n[5] Admin login and offers listing");
  const admin = await login("tpadmin@iist.ac.in", "Password@123");
  admin.has("session-token") ? ok("admin session cookie issued") : fail("admin login failed");

  const adminOffers = await get("/api/admin/offers?includeStats=true", admin);
  adminOffers.status === 200
    ? ok(
        `admin /api/admin/offers 200 — ${adminOffers.json?.offers?.length ?? 0} offer(s), total stat=${adminOffers.json?.stats?.total}`
      )
    : fail(`admin offers returned ${adminOffers.status}: ${adminOffers.text.slice(0, 200)}`);

  const offerable = await get("/api/admin/offers/offerable-applications", admin);
  offerable.status === 200
    ? ok(
        `offerable-applications 200 — ${offerable.json?.applications?.length ?? 0} pending`
      )
    : fail(`offerable returned ${offerable.status}`);

  console.log(
    process.exitCode ? "\n=== FAILURES PRESENT ===\n" : "\n=== All HTTP checks passed ===\n"
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

export {};
