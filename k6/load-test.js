/**
 * Phase 16 — P8. Load test against the real running app (local dev server
 * — see the note in LAUNCH_CHECKLIST.md §7.8 about why this run used a
 * production build, not `next dev`, despite the URL still being
 * localhost). Models a realistic mix of concurrent activity, not 1000
 * users doing the exact same thing at the exact same millisecond:
 *
 *   70% — student browse+apply: opportunities list, notification peek,
 *         and (a fraction of the time) a real apply POST.
 *   15% — student tracking: applications list + notification peek,
 *         simulating someone with the app open polling.
 *   10% — admin: the shortlist queue for a 120-applicant drive, the
 *         Command Center analytics endpoint, and a report export.
 *    5% — staff dashboards (faculty/HOD/company rep, rotated).
 *
 * Fixture data: scripts/seed-volume.ts (220 real student logins,
 * "E2E Volume Drive" with 120 applicants) — run that first. JOB_ROLE_ID /
 * VOLUME_DRIVE_ID below are real ids looked up once against that fixture
 * (see the commit message / LAUNCH_CHECKLIST.md).
 *
 * Every request carries a synthetic X-Forwarded-For header, one distinct
 * fake IP per VU. Without this, lib/rate-limit.ts's clientIp() falls back
 * to a session cookie (no reverse proxy in a bare `next dev`/local run
 * sets a real x-forwarded-for) — and because k6 keeps ONE cookie jar per
 * VU across every iteration (not one per iteration), every login from a
 * given VU shares that VU's single cookie identity regardless of which
 * simulated student it's logging in as, so the 10/min login bucket blows
 * almost immediately even at 10 VUs. That's a k6-vs-no-reverse-proxy
 * artifact, not a production bug: real users each have distinct real
 * IPs, and Vercel does set x-forwarded-for correctly. This header is
 * this test's way of modeling that real-world distinctness, the same way
 * it would actually look in production.
 *
 * Run: k6 run k6/load-test.js
 * Override target/VUs: k6 run -e BASE_URL=... k6/load-test.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:4242";
const JOB_ROLE_ID = __ENV.JOB_ROLE_ID || "cmtu0imy30004w4cjx72qgotx";
const VOLUME_DRIVE_ID = __ENV.VOLUME_DRIVE_ID || "cmty16o8t00umcgpd808smm1j";
const STUDENT_POOL_SIZE = 220;

const applyErrors = new Rate("apply_errors");
const loginErrors = new Rate("login_errors");
const reportDuration = new Trend("report_generation_duration", true);
const shortlistQueueDuration = new Trend("shortlist_queue_duration", true);

const TARGET_VUS = Number(__ENV.TARGET_VUS) || 1000;

export const options = {
  stages: [
    { duration: "1m", target: TARGET_VUS }, // ramp-up
    { duration: "2m", target: TARGET_VUS }, // sustained peak
    { duration: "30s", target: 0 }, // ramp-down
  ],
  thresholds: {
    http_req_duration: ["p(95)<3000"], // generous for a single dev-hardware instance — see LAUNCH_CHECKLIST.md for the honest caveat
    login_errors: ["rate<0.05"],
  },
};

const STAFF_ACCOUNTS = [
  { id: "e2e-faculty@iist.ac.in", label: "faculty" },
  { id: "hod@iist.ac.in", label: "hod" },
  { id: "e2e-rep-a@example.com", label: "company" },
];

function fakeIpFor(vu) {
  // 10.x.x.x is plenty of address space for a 1000-VU run.
  const n = vu % 65536;
  return `10.0.${Math.floor(n / 256)}.${n % 256}`;
}

/** Real NextAuth credentials login (CSRF dance), matching the actual login form. */
function login(loginId, headers) {
  const csrfRes = http.get(`${BASE_URL}/api/auth/csrf`, { headers });
  const csrfToken = csrfRes.json("csrfToken");

  const res = http.post(
    `${BASE_URL}/api/auth/callback/credentials`,
    {
      enrollmentNumber: loginId,
      password: "Password@123",
      csrfToken,
      callbackUrl: `${BASE_URL}/dashboard`,
      json: "true",
    },
    { headers, redirects: 0 }
  );

  const ok = res.status === 200 || res.status === 302;
  loginErrors.add(!ok);
  if (!ok) {
    console.log(`login unexpected status=${res.status} for ${loginId}: ${res.body?.slice(0, 300)}`);
  }
  return ok;
}

function studentBrowseAndApply(studentId, headers) {
  if (!login(studentId, headers)) return;

  const oppsRes = http.get(`${BASE_URL}/api/student/opportunities?limit=20`, { headers });
  check(oppsRes, { "opportunities 200": (r) => r.status === 200 });

  http.get(`${BASE_URL}/api/notifications/peek`, { headers });
  sleep(Math.random() * 2);

  // Not every visit ends in an apply — roughly 1 in 4, and "already
  // applied"/rate-limited/ineligible is an accepted, expected outcome
  // under real concurrency, not a failure.
  if (Math.random() < 0.25) {
    const applyRes = http.post(
      `${BASE_URL}/api/student/applications`,
      JSON.stringify({ jobRoleId: JOB_ROLE_ID, confirmed: true }),
      { headers: { ...headers, "Content-Type": "application/json" } }
    );
    // 403 is real and expected here too — the volume-seed students
    // (scripts/seed-volume.ts) have no SkillUp scores, so this role's
    // real eligibility rule correctly rejects them, same as it would any
    // real ineligible student.
    const acceptable = [201, 400, 403, 409, 429].includes(applyRes.status);
    applyErrors.add(!acceptable);
    if (!acceptable) {
      console.log(`apply unexpected status=${applyRes.status} body=${applyRes.body}`);
    }
    check(applyRes, { "apply: real success or expected rejection": () => acceptable });
  }
}

function studentTracking(studentId, headers) {
  if (!login(studentId, headers)) return;
  http.get(`${BASE_URL}/api/student/applications?limit=20`, { headers });
  sleep(Math.random() * 2);
  http.get(`${BASE_URL}/api/notifications/peek`, { headers });
}

function adminFlow(headers) {
  if (!login("e2e-admin@iist.ac.in", headers)) return;

  const t0 = Date.now();
  const shortlistRes = http.get(
    `${BASE_URL}/api/admin/drives/${VOLUME_DRIVE_ID}/shortlist?limit=100`,
    { headers }
  );
  shortlistQueueDuration.add(Date.now() - t0);
  check(shortlistRes, { "shortlist queue 200": (r) => r.status === 200 });

  http.get(`${BASE_URL}/api/admin/analytics/command-center`, { headers });
  sleep(Math.random());

  const t1 = Date.now();
  const reportRes = http.get(`${BASE_URL}/api/admin/reports/students?format=csv`, { headers });
  reportDuration.add(Date.now() - t1);
  check(reportRes, { "report generation ok or rate-limited": (r) => [200, 429].includes(r.status) });
}

function staffDashboard(headers) {
  const account = STAFF_ACCOUNTS[Math.floor(Math.random() * STAFF_ACCOUNTS.length)];
  if (!login(account.id, headers)) return;
  http.get(`${BASE_URL}/dashboard`, { headers });
  http.get(`${BASE_URL}/api/notifications/peek`, { headers });
}

export default function () {
  const headers = { "X-Forwarded-For": fakeIpFor(__VU) };
  const studentId = `e2e-volume-student-${Math.floor(Math.random() * STUDENT_POOL_SIZE)}@iist.ac.in`;
  const roll = Math.random();

  if (roll < 0.7) {
    studentBrowseAndApply(studentId, headers);
  } else if (roll < 0.85) {
    studentTracking(studentId, headers);
  } else if (roll < 0.95) {
    adminFlow(headers);
  } else {
    staffDashboard(headers);
  }

  sleep(1 + Math.random() * 2);
}
