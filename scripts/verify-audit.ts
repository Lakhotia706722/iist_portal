/**
 * P1.1 verification: every state-changing placement action writes an AuditLog row.
 * Run: npx tsx scripts/verify-audit.ts
 */

import { prisma } from "../lib/prisma";
import { createDrive, updateDriveStatus, updateDrive } from "../server/services/drive.service";
import { createRound } from "../server/services/round.service";
import { bulkShortlistApplications } from "../server/services/shortlist.service";
import { markAttendance } from "../server/services/attendance.service";
import { updateApplicationStatus } from "../server/services/application.service";

const ok = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string) => {
  console.error(`  ✗ ${m}`);
  process.exitCode = 1;
};

/** Run `fn`, then assert an AuditLog row for `entity` appeared. */
async function expectsAudit(label: string, entity: string, fn: () => Promise<unknown>) {
  const before = await prisma.auditLog.count({ where: { entity } });
  try {
    await fn();
  } catch (e) {
    fail(`${label} threw: ${(e as Error).message}`);
    return;
  }
  const after = await prisma.auditLog.count({ where: { entity } });
  after > before
    ? ok(`${label} -> AuditLog(${entity}) +${after - before}`)
    : fail(`${label} wrote NO AuditLog row for ${entity}`);
}

async function main() {
  console.log("\n=== P1.1 audit coverage verification ===\n");

  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "tpadmin@iist.ac.in" } });
  const company = await prisma.company.findFirstOrThrow({ where: { slug: "verify-corp" } });
  const student = await prisma.student.findFirstOrThrow({
    where: { user: { email: "student@iist.ac.in" } },
  });

  // Drive create / update / status
  let driveId = "";
  await expectsAudit("createDrive", "PlacementDrive", async () => {
    const d = await createDrive(
      {
        companyId: company.id,
        title: `Audit Drive ${Date.now()}`,
        academicYear: "2024-2025",
        workMode: "ONSITE",
        locations: ["Bengaluru"],
      } as any,
      admin.id
    );
    driveId = d.id;
  });

  await expectsAudit("updateDrive", "PlacementDrive", () =>
    updateDrive(driveId, { description: "audited edit" } as any, admin.id)
  );

  await expectsAudit("updateDriveStatus (publish)", "PlacementDrive", () =>
    updateDriveStatus(driveId, "PUBLISHED", admin.id)
  );

  // Rounds may only be created once applications have closed.
  await updateDriveStatus(driveId, "APPLICATIONS_OPEN", admin.id);
  await updateDriveStatus(driveId, "APPLICATIONS_CLOSED", admin.id);

  await expectsAudit("createRound", "PlacementRound", () =>
    createRound(driveId, { roundNumber: 1, title: "Aptitude", type: "APTITUDE_TEST", mode: "ONLINE" } as any, admin.id)
  );

  // Application status change (individual reject/shortlist path)
  const role = await prisma.jobRole.findFirstOrThrow({ where: { drive: { company: { slug: "verify-corp" } } } });
  const app = await prisma.application.upsert({
    where: { studentId_jobRoleId: { studentId: student.id, jobRoleId: role.id } },
    update: { status: "APPLIED" },
    create: { studentId: student.id, driveId: role.driveId, jobRoleId: role.id, status: "APPLIED" },
  });

  await expectsAudit("updateApplicationStatus", "Application", () =>
    updateApplicationStatus(app.id, { status: "UNDER_REVIEW" } as any, admin.id)
  );

  await expectsAudit("bulkShortlistApplications", "Application", () =>
    bulkShortlistApplications(
      { applicationIds: [app.id], action: "SHORTLISTED", note: "audit test" },
      admin.id
    )
  );

  // Attendance marking
  const round = await prisma.placementRound.findFirstOrThrow({ where: { driveId } });
  const participant = await prisma.roundParticipant.upsert({
    where: { roundId_applicationId: { roundId: round.id, applicationId: app.id } },
    update: {},
    create: { roundId: round.id, applicationId: app.id },
  });

  await expectsAudit("markAttendance", "AttendanceRecord", () =>
    markAttendance(participant.id, { status: "PRESENT" } as any, admin.id)
  );

  // Every audited row must name an actor.
  const orphaned = await prisma.auditLog.count({
    where: {
      entity: { in: ["PlacementDrive", "PlacementRound", "AttendanceRecord", "Offer"] },
      userId: null,
    },
  });
  orphaned === 0
    ? ok("all placement audit rows carry a userId")
    : fail(`${orphaned} placement audit row(s) have a null userId`);

  console.log(
    process.exitCode ? "\n=== FAILURES PRESENT ===\n" : "\n=== Audit coverage verified ===\n"
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
