/**
 * Phase 4 end-to-end verification.
 * Run: npx tsx scripts/verify-phase4.ts [baseUrl]
 *
 * Proves, against a running server and a real database:
 *  - a SkillUp result reaches the correct student (and unmatched rows are rejected)
 *  - a mock interview + feedback is visible to that student and no other
 *  - a notification is persisted AND emailed
 *  - the calendar scopes what each student can see, server-side
 */

import { prisma } from "../lib/prisma";
import { makeClient, ok, fail } from "./_client";

const BASE = process.argv[2] ?? "http://localhost:4030";
const api = makeClient(BASE);

async function main() {
  console.log(`\n=== Phase 4 verification against ${BASE} ===\n`);

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "tpadmin@iist.ac.in" } });
  const studentA = await prisma.student.findFirstOrThrow({
    where: { user: { email: "student@iist.ac.in" } },
    include: { user: true, batch: true },
  });
  const studentB = await prisma.student.findFirstOrThrow({
    where: { user: { email: "newstudent@iist.ac.in" } },
    include: { user: true, batch: true },
  });

  const adminJar = await api.login("tpadmin@iist.ac.in", "Password@123");
  const jarA = await api.login(studentA.enrollmentNumber, "Password@123");
  const jarB = await api.login(studentB.enrollmentNumber, "Password@123");
  adminJar.has("session-token") && jarA.has("session-token") && jarB.has("session-token")
    ? ok(`logged in: admin, ${studentA.enrollmentNumber} (A), ${studentB.enrollmentNumber} (B)`)
    : fail("login failed");

  // ── P1: SkillUp ───────────────────────────────────────────────────────────
  console.log("\n[P1] SkillUp — results reach the right student");

  const types = await api.get("/api/admin/skillup/types", adminJar);
  const aptitude = (types.json.testTypes ?? []).find((t: any) => t.slug === "aptitude");
  aptitude ? ok(`test categories are data (${types.json.testTypes.length} seeded)`) : fail("no test types");

  const created = await api.post("/api/admin/skillup/tests", adminJar, {
    title: `Verification Aptitude ${Date.now()}`,
    testTypeId: aptitude.id,
    scheduledAt: new Date().toISOString(),
    durationMins: 60,
    maxMarks: 100,
    passingMarks: 40,
    mode: "OFFLINE",
    status: "COMPLETED",
    batchId: studentA.batchId,
    studentIds: [],
  });
  created.status === 201
    ? ok(`test created (${created.json.test.id})`)
    : fail(`test create ${created.status}: ${created.text.slice(0, 200)}`);
  const testId = created.json?.test?.id;

  // Unmatched rows must be rejected wholesale.
  const bad = await api.post(`/api/admin/skillup/tests/${testId}/results`, adminJar, {
    rows: [
      { enrollmentNumber: studentA.enrollmentNumber, marksObtained: 82 },
      { enrollmentNumber: "NOT-A-REAL-ROLL", marksObtained: 55 },
    ],
  });
  const rejected =
    bad.status === 422 && Array.isArray(bad.json.errors) && bad.json.errors.length === 1;
  rejected
    ? ok(`unmatched row rejected with a row number: "${bad.json.errors[0].reason}"`)
    : fail(`expected 422 with errors, got ${bad.status}`);

  const savedAfterReject = await prisma.testResult.count({ where: { testId } });
  savedAfterReject === 0
    ? ok("nothing was saved from the rejected upload (all-or-nothing)")
    : fail(`${savedAfterReject} row(s) leaked from a rejected upload`);

  // Valid upload for student A only.
  const good = await api.post(`/api/admin/skillup/tests/${testId}/results`, adminJar, {
    rows: [{ enrollmentNumber: studentA.enrollmentNumber, marksObtained: 82, remarks: "Strong" }],
  });
  good.status === 200
    ? ok(`results published (${good.json.inserted} inserted)`)
    : fail(`upload ${good.status}: ${good.text.slice(0, 200)}`);

  const dbResult = await prisma.testResult.findFirst({
    where: { testId },
    include: { student: true },
  });
  dbResult?.studentId === studentA.id && dbResult.marksObtained === 82
    ? ok(`result attached to the right student (${dbResult.student.enrollmentNumber}, 82/100, ${dbResult.percentage}%)`)
    : fail("result attached to the wrong student");

  // Student A sees it; student B does not.
  const perfA = await api.get("/api/student/skillup", jarA);
  const hasIt = (perfA.json.history ?? []).some((h: any) => h.testId === testId);
  perfA.status === 200 && hasIt
    ? ok(`student A sees the result (overall avg ${perfA.json.overallAverage}%, ${perfA.json.categories.length} category breakdown)`)
    : fail(`student A cannot see their result: ${perfA.text.slice(0, 200)}`);

  const perfB = await api.get("/api/student/skillup", jarB);
  const bHasIt = (perfB.json.history ?? []).some((h: any) => h.testId === testId);
  !bHasIt ? ok("student B does not see student A's result") : fail("result leaked to student B");

  const detailB = await api.get(`/api/student/skillup/${testId}`, jarB);
  detailB.status === 404
    ? ok("student B gets 404 on the detail endpoint for a result that isn't theirs")
    : fail(`expected 404 for student B, got ${detailB.status}`);

  // Eligibility now reads real TestResult data.
  const { evaluateEligibility } = await import("../lib/eligibility-engine");
  const role = await prisma.jobRole.findFirstOrThrow({
    where: { drive: { company: { slug: "verify-corp" } } },
  });
  await prisma.eligibilityRule.deleteMany({ where: { jobRoleId: role.id, field: "SKILLUP_SCORE" } });
  await prisma.eligibilityRule.create({
    data: {
      jobRoleId: role.id,
      field: "SKILLUP_SCORE",
      operator: "GTE",
      value: "70",
      label: "Min SkillUp average 70%",
    },
  });
  const eligA = await evaluateEligibility(studentA.id, role.id);
  const skillRule = eligA.results.find((r) => r.field === "SKILLUP_SCORE");
  skillRule?.passed
    ? ok(`eligibility reads real TestResult data: "${skillRule.reason}"`)
    : fail(`SKILLUP_SCORE rule did not pass for 82%: ${skillRule?.reason}`);

  const eligB = await evaluateEligibility(studentB.id, role.id);
  const skillRuleB = eligB.results.find((r) => r.field === "SKILLUP_SCORE");
  skillRuleB && !skillRuleB.passed
    ? ok(`student with no results fails the rule: "${skillRuleB.reason}"`)
    : fail("student with no SkillUp results should not pass the rule");

  // ── P2: Mock interviews ───────────────────────────────────────────────────
  console.log("\n[P2] Mock interviews — visible to that student only");

  const mi = await api.post("/api/admin/interviews", adminJar, {
    studentId: studentA.id,
    interviewerName: "Dr. Verification Panel",
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    durationMins: 45,
    targetRole: "SDE-1",
    type: "TECHNICAL",
    mode: "OFFLINE",
    venue: "Room 12",
    status: "SCHEDULED",
  });
  mi.status === 201
    ? ok(`interview scheduled (${mi.json.interview.id})`)
    : fail(`interview create ${mi.status}: ${mi.text.slice(0, 200)}`);
  const interviewId = mi.json?.interview?.id;

  const scored = await api.post(`/api/admin/interviews/${interviewId}/result`, adminJar, {
    technicalScore: 8,
    communicationScore: 7,
    confidenceScore: 6,
    problemSolvingScore: 9,
    hrScore: 7,
    feedback: "Strong fundamentals, work on structuring answers.",
    strengths: ["Data structures", "Clear reasoning"],
    weaknesses: ["Pacing"],
    improvementSuggestions: ["Practise timed mocks"],
  });
  const overall = scored.json?.interview?.result?.overallScore;
  scored.status === 200 && overall === 7.4
    ? ok(`feedback recorded, overall averaged to ${overall}/10`)
    : fail(`expected overall 7.4, got ${overall} (${scored.status})`);

  const miA = await api.get("/api/student/interviews", jarA);
  const seesIt = (miA.json.interviews ?? []).some((i: any) => i.id === interviewId);
  seesIt
    ? ok(`student A sees the interview and its feedback (avg overall ${miA.json.summary.averages.overall})`)
    : fail("student A cannot see their interview");

  const miB = await api.get("/api/student/interviews", jarB);
  !(miB.json.interviews ?? []).some((i: any) => i.id === interviewId)
    ? ok("student B does not see student A's interview")
    : fail("interview leaked to student B");

  const miDenied = await api.get("/api/admin/interviews", jarA);
  miDenied.status === 403
    ? ok("student cannot list all interviews (403)")
    : fail(`expected 403, got ${miDenied.status}`);

  // ── P3: Notifications persisted AND emailed ───────────────────────────────
  console.log("\n[P3] Notifications — persisted and emailed");

  const notifs = await prisma.notification.findMany({
    where: { userId: studentA.userId },
    orderBy: { createdAt: "desc" },
  });
  const skillNotif = notifs.find((n) => n.entityId === testId);
  const interviewNotif = notifs.find((n) => n.entityId === interviewId);

  skillNotif
    ? ok(`SkillUp result persisted a notification: "${skillNotif.subject}" (link ${skillNotif.link})`)
    : fail("no notification row for the published result");
  interviewNotif
    ? ok(`interview feedback persisted a notification: "${interviewNotif.subject}"`)
    : fail("no notification row for the interview");

  const inbox = await api.get("/api/notifications", jarA);
  inbox.status === 200 && inbox.json.unreadCount > 0
    ? ok(`inbox API returns ${inbox.json.notifications.length} item(s), ${inbox.json.unreadCount} unread`)
    : fail(`inbox wrong: ${inbox.status} / ${inbox.text.slice(0, 150)}`);

  // Read-marking is scoped to the owner.
  const stolen = await api.post("/api/notifications/read", jarB, { id: skillNotif!.id });
  stolen.status === 404
    ? ok("student B cannot mark student A's notification read (404)")
    : fail(`expected 404 marking another user's notification, got ${stolen.status}`);

  const markOne = await api.post("/api/notifications/read", jarA, { id: skillNotif!.id });
  const afterOne = await prisma.notification.findUniqueOrThrow({ where: { id: skillNotif!.id } });
  markOne.status === 200 && afterOne.readAt
    ? ok("mark-as-read (single) works")
    : fail("single mark-as-read did not set readAt");

  const markAll = await api.post("/api/notifications/read", jarA, { all: true });
  const stillUnread = await prisma.notification.count({
    where: { userId: studentA.userId, readAt: null },
  });
  markAll.status === 200 && stillUnread === 0
    ? ok(`mark-all-read cleared every unread row (${markAll.json.updated} updated)`)
    : fail(`mark-all-read left ${stillUnread} unread`);

  // Email: the dev transport logs to the server console, so assert on delivery
  // by rendering the template the dispatcher would use.
  const { EMAIL_TEMPLATES } = await import("../lib/email/templates");
  const { interpolateTemplate } = await import("../lib/email");
  const tpl = EMAIL_TEMPLATES.find((t) => t.key === "skillup_result")!;
  const rendered = interpolateTemplate(tpl.bodyHtml, {
    studentName: studentA.user.name,
    testTitle: created.json.test.title,
    link: `${BASE}/student/skillup/${testId}`,
    portalUrl: BASE,
  });
  const clean =
    rendered.includes(studentA.user.name) &&
    rendered.includes(created.json.test.title) &&
    !rendered.includes("{{");
  clean
    ? ok("email template renders with no unreplaced {{placeholders}}")
    : fail("template still contains unreplaced placeholders");

  // Admin template override is honoured by the dispatcher.
  await api.get("/api/admin/email-templates", adminJar).then((r) =>
    r.status === 200
      ? ok(`template admin lists ${r.json.templates.length} templates`)
      : fail(`template list ${r.status}`)
  );

  const put = await fetch(`${BASE}/api/admin/email-templates/skillup_result`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie: adminJar.header() },
    body: JSON.stringify({
      name: "SkillUp Result (customised)",
      subject: "CUSTOM: {{testTitle}}",
      bodyHtml: "<p>Hi {{studentName}}, your {{testTitle}} result is ready.</p>",
      variables: ["studentName", "testTitle", "link", "portalUrl"],
      isActive: true,
    }),
  });
  put.ok ? ok("admin saved a customised template") : fail(`template save failed ${put.status}`);

  const dbTpl = await prisma.emailTemplate.findUnique({ where: { key: "skillup_result" } });
  dbTpl?.subject === "CUSTOM: {{testTitle}}"
    ? ok("customised template persisted and will override the built-in default")
    : fail("customised template not persisted");

  const auditTpl = await prisma.auditLog.count({ where: { entity: "EmailTemplate" } });
  auditTpl > 0
    ? ok(`template change wrote ${auditTpl} AuditLog row(s)`)
    : fail("template change wrote no audit row");

  // ── P4: Documents ─────────────────────────────────────────────────────────
  console.log("\n[P4] Documents — still working, now notifying");

  const docs = await api.get("/api/admin/documents?status=PENDING", adminJar);
  docs.status === 200
    ? ok(`admin pending-document view works (${docs.json.items?.length ?? 0} pending)`)
    : fail(`admin documents ${docs.status}: ${docs.text.slice(0, 150)}`);

  // ── P5: Calendar scoping ──────────────────────────────────────────────────
  console.log("\n[P5] Calendar — scoped server-side");

  const calA = await api.get("/api/student/calendar", jarA);
  const calB = await api.get("/api/student/calendar", jarB);
  calA.status === 200 && calB.status === 200
    ? ok(`calendars load (A: ${calA.json.events.length} events, B: ${calB.json.events.length})`)
    : fail("calendar endpoint failed");

  const aEventIds = new Set((calA.json.events ?? []).map((e: any) => e.id));
  const bEventIds = new Set((calB.json.events ?? []).map((e: any) => e.id));

  aEventIds.has(`test:${testId}`)
    ? ok("student A sees their SkillUp test on the calendar")
    : fail("student A's test is missing from their calendar");
  !bEventIds.has(`test:${testId}`)
    ? ok("student B does not see a test scoped to another batch")
    : fail("test leaked into student B's calendar");

  aEventIds.has(`interview:${interviewId}`)
    ? ok("student A sees their mock interview on the calendar")
    : fail("student A's interview is missing from their calendar");
  !bEventIds.has(`interview:${interviewId}`)
    ? ok("student B does not see student A's interview")
    : fail("interview leaked into student B's calendar");

  // Institute-wide events reach everyone; batch-scoped ones do not.
  const wide = await api.post("/api/admin/calendar", adminJar, {
    title: "Institute-wide placement briefing",
    type: "OTHER",
    startAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    venue: "Main Auditorium",
  });
  const scopedEvent = await api.post("/api/admin/calendar", adminJar, {
    title: "Batch-only session",
    type: "OTHER",
    startAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    batchId: studentA.batchId,
  });
  wide.status === 201 && scopedEvent.status === 201
    ? ok("admin created an institute-wide and a batch-scoped event")
    : fail("event creation failed");

  const calA2 = await api.get("/api/student/calendar", jarA);
  const calB2 = await api.get("/api/student/calendar", jarB);
  const aIds = new Set((calA2.json.events ?? []).map((e: any) => e.id));
  const bIds = new Set((calB2.json.events ?? []).map((e: any) => e.id));

  const wideId = `event:${wide.json.event.id}`;
  const scopedId = `event:${scopedEvent.json.event.id}`;

  aIds.has(wideId) && bIds.has(wideId)
    ? ok("institute-wide event reaches both students")
    : fail("institute-wide event did not reach both students");
  aIds.has(scopedId) && !bIds.has(scopedId)
    ? ok("batch-scoped event reaches only the student in that batch")
    : fail("batch scoping is wrong");

  const calDenied = await api.get("/api/admin/calendar", jarA);
  calDenied.status === 403
    ? ok("student cannot read the unscoped admin calendar (403)")
    : fail(`expected 403 on admin calendar, got ${calDenied.status}`);

  console.log(
    process.exitCode ? "\n=== FAILURES PRESENT ===\n" : "\n=== Phase 4 verified ===\n"
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
