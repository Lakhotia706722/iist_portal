/**
 * Phase 6 runtime smoke test — CSP nonce coverage.
 *
 * Confirms, against a real running dev/prod server (not just that the build
 * compiles), that:
 *  - a public auth page (/login) returns a Content-Security-Policy header
 *    containing a nonce
 *  - an unauthenticated request to a protected page gets redirected to
 *    /login and that redirect response *also* carries a nonce'd CSP
 *  - two separate requests get two different nonces (proves it's generated
 *    per-request, not a stale/cached constant)
 *
 * Run: npx tsx scripts/verify-phase6.ts [baseUrl]
 * (requires a dev server already running, e.g. `npm run dev`)
 */

const baseUrl = process.argv[2] ?? "http://localhost:3000";

const ok = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string) => {
  console.error(`  ✗ ${m}`);
  process.exitCode = 1;
};

function extractNonce(csp: string | null): string | null {
  if (!csp) return null;
  const match = csp.match(/'nonce-([^']+)'/);
  return match ? match[1] : null;
}

async function main() {
  console.log(`\n=== Phase 6 CSP nonce smoke test — ${baseUrl} ===\n`);

  // 1. Public page: /login
  const loginRes = await fetch(`${baseUrl}/login`, { redirect: "manual" });
  const loginCsp = loginRes.headers.get("content-security-policy");
  loginCsp ? ok("/login response carries a Content-Security-Policy header") : fail("/login has no CSP header");
  const loginNonce = extractNonce(loginCsp);
  loginNonce ? ok(`/login CSP contains a nonce (${loginNonce.slice(0, 12)}…)`) : fail("/login CSP has no nonce directive");

  // 2. Protected page, unauthenticated: should redirect to /login, and that
  //    redirect response should itself carry a nonce'd CSP.
  const dashRes = await fetch(`${baseUrl}/student/dashboard`, { redirect: "manual" });
  const isRedirect = dashRes.status >= 300 && dashRes.status < 400;
  isRedirect
    ? ok(`unauthenticated /student/dashboard redirects (${dashRes.status}) as expected`)
    : fail(`unauthenticated /student/dashboard did not redirect (got ${dashRes.status})`);
  const dashCsp = dashRes.headers.get("content-security-policy");
  const dashNonce = extractNonce(dashCsp);
  dashNonce ? ok("redirect response also carries a nonce'd CSP") : fail("redirect response missing nonce'd CSP");

  // 3. Two requests -> two different nonces (per-request, not cached).
  const secondLoginRes = await fetch(`${baseUrl}/login`, { redirect: "manual" });
  const secondNonce = extractNonce(secondLoginRes.headers.get("content-security-policy"));
  loginNonce && secondNonce && loginNonce !== secondNonce
    ? ok("two separate /login requests get two different nonces (per-request generation confirmed)")
    : fail("nonce did not change between requests — looks cached/constant, not per-request");

  console.log(
    process.exitCode
      ? "\n=== FAILURES PRESENT ===\n"
      : "\n=== CSP nonce coverage verified end-to-end ===\n"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
