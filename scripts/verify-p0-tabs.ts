/**
 * Phase 4 P0 verification: drive Applications + Attendance tabs against real data.
 * Run: npx tsx scripts/verify-p0-tabs.ts [baseUrl]
 */

import { prisma } from "../lib/prisma";
import { makeClient, ok, fail } from "./_client";

const BASE = process.argv[2] ?? "http://localhost:4020";
const api = makeClient(BASE);

async function main() {
  console.log(`\n=== P0 tab verification against ${BASE} ===\n`);

  console.log("[1] Fixture: drive with applicants and a round");
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "tpadmin@iist.ac.in" } });
  const company = await prisma.company.findFirstOrThrow({ where: { slug: "verify-corp" } });

  const drive = await prisma.placementDrive.upsert({
    where: { id: "p0-verify-drive" },
    update: { status: "APPLICATIONS_CLOSED" },
    create: {
      id: "p0-verify-drive",
      companyId: company.id,
      title: "P0 Tab Verification Drive",
      academicYear: "2024-2025",
      status: "APPLICATIONS_CLOSED",
      createdById: admin.id,
    },
  });

  const role = await prisma.jobRole.upsert({
    where: { id: "p0-verify-role" },
    update: {},
    create: { id: "p0-verify-role", driveId: drive.id, title: "P0 Verification Engineer" },
  });

  const students = await prisma.student.findMany({
    take: 2,
    include: { batch: { include: { branch: true } }, academicRecord: true },
  });
  if (students.length === 0) throw new Error("No students seeded");

  for (const s of students) {
    await prisma.application.upsert({
      where: { studentId_jobRoleId: { studentId: s.id, jobRoleId: role.id } },
      update: { status: "APPLIED" },
      create: {
        studentId: s.id,
        driveId: drive.id,
        jobRoleId: role.id,
        status: "APPLIED",
      },
    });
  }

  const round = await prisma.placementRound.upsert({
    where: { driveId_roundNumber: { driveId: drive.id, roundNumber: 1 } },
    update: {},
    create: {
      driveId: drive.id,
      roundNumber: 1,
      title: "P0 Aptitude Round",
      type: "APTITUDE_TEST",
      mode: "OFFLINE",
      venue: "Hall A",
      scheduledAt: new Date(Date.now() + 86400000),
    },
  });

  const apps = await prisma.application.findMany({ where: { jobRoleId: role.id } });
  for (const a of apps) {
    await prisma.roundParticipant.upsert({
      where: { roundId_applicationId: { roundId: round.id, applicationId: a.id } },
      update: {},
      create: { roundId: round.id, applicationId: a.id },
    });
  }
  ok(`fixture: drive=${drive.id} role=${role.id} round=${round.id} applicants=${apps.length}`);

  const adminJar = await api.login("tpadmin@iist.ac.in", "Password@123");
  adminJar.has("session-token") ? ok("admin logged in") : fail("admin login failed");

  // ── Applications tab ──────────────────────────────────────────────────────
  console.log("\n[2] Applications tab API");
  const list = await api.get(`/api/admin/drives/${drive.id}/applications`, adminJar);
  if (list.status !== 200) {
    fail(`applications returned ${list.status}: ${list.text.slice(0, 200)}`);
  } else {
    const rows = list.json.applications ?? [];
    rows.length === apps.length
      ? ok(`returned ${rows.length} applicant(s)`)
      : fail(`expected ${apps.length} applicants, got ${rows.length}`);

    const first = rows[0];
    const hasFields =
      first?.student?.enrollmentNumber &&
      first?.jobRole?.title &&
      "academicRecord" in (first?.student ?? {}) &&
      first?.student?.batch !== undefined;
    hasFields
      ? ok("rows carry the fields the table renders (enrollment, branch/batch, CGPA, role)")
      : fail(`row shape missing fields: ${JSON.stringify(first).slice(0, 250)}`);

    list.json.stats?.byStatus
      ? ok(`status facets present: ${JSON.stringify(list.json.stats.byStatus)}`)
      : fail("stats.byStatus missing (status filter chips need it)");
  }

  // Server-side filters the UI relies on
  const filtered = await api.get(
    `/api/admin/drives/${drive.id}/applications?status=SELECTED`,
    adminJar
  );
  filtered.status === 200 && (filtered.json.applications ?? []).length === 0
    ? ok("status filter applied server-side (SELECTED -> 0 rows)")
    : fail(`status filter wrong: ${filtered.status} / ${filtered.json?.applications?.length}`);

  const searched = await api.get(
    `/api/admin/drives/${drive.id}/applications?search=${students[0].enrollmentNumber}`,
    adminJar
  );
  searched.status === 200 && (searched.json.applications ?? []).length === 1
    ? ok("search filter applied server-side (1 match)")
    : fail(`search filter wrong: got ${searched.json?.applications?.length}`);

  // Authorization
  const studentJar = await api.login("IIST2021CS01", "Password@123");
  const denied = await api.get(`/api/admin/drives/${drive.id}/applications`, studentJar);
  denied.status === 403
    ? ok("student -> drive applications returns 403")
    : fail(`expected 403 for student, got ${denied.status}`);

  // ── Attendance tab ────────────────────────────────────────────────────────
  console.log("\n[3] Attendance tab API");
  const roundsRes = await api.get(`/api/admin/drives/${drive.id}/rounds`, adminJar);
  (roundsRes.json.rounds ?? []).length > 0
    ? ok(`round picker source returns ${roundsRes.json.rounds.length} round(s)`)
    : fail("rounds list empty");

  const att = await api.get(`/api/admin/rounds/${round.id}/attendance`, adminJar);
  if (att.status !== 200) {
    fail(`attendance GET ${att.status}: ${att.text.slice(0, 200)}`);
  } else {
    ok(`attendance GET 200 — ${att.json.participants?.length ?? 0} participant(s)`);
  }

  const participants = att.json?.participants ?? [];
  if (participants.length < 2) {
    fail("need >= 2 participants to test single + bulk marking");
  } else {
    const auditBefore = await prisma.auditLog.count({ where: { entity: "AttendanceRecord" } });

    // single
    const single = await api.post(`/api/admin/rounds/${round.id}/attendance`, adminJar, {
      roundParticipantId: participants[0].id,
      status: "PRESENT",
    });
    single.status === 200
      ? ok("single mark PRESENT -> 200")
      : fail(`single mark ${single.status}: ${single.text.slice(0, 200)}`);

    // bulk
    const bulk = await api.post(`/api/admin/rounds/${round.id}/attendance`, adminJar, {
      records: participants.map((p: any) => ({ roundParticipantId: p.id, status: "LATE" })),
    });
    bulk.status === 200 && bulk.json.updated === participants.length
      ? ok(`bulk mark LATE -> ${bulk.json.updated} updated`)
      : fail(`bulk mark wrong: ${bulk.status} updated=${bulk.json?.updated}`);

    // persisted?
    const after = await api.get(`/api/admin/rounds/${round.id}/attendance`, adminJar);
    const allLate = (after.json.participants ?? []).every(
      (p: any) => p.attendance?.status === "LATE"
    );
    allLate
      ? ok("attendance persisted and reads back as LATE for all participants")
      : fail(
          `persistence wrong: ${JSON.stringify(
            (after.json.participants ?? []).map((p: any) => p.attendance?.status)
          )}`
        );

    const auditAfter = await prisma.auditLog.count({ where: { entity: "AttendanceRecord" } });
    auditAfter > auditBefore
      ? ok(`attendance marking wrote ${auditAfter - auditBefore} AuditLog row(s)`)
      : fail("attendance marking wrote no AuditLog rows");
  }

  const attDenied = await api.get(`/api/admin/rounds/${round.id}/attendance`, studentJar);
  attDenied.status === 403
    ? ok("student -> round attendance returns 403")
    : fail(`expected 403 for student, got ${attDenied.status}`);

  console.log(process.exitCode ? "\n=== FAILURES PRESENT ===\n" : "\n=== P0 tabs verified ===\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
