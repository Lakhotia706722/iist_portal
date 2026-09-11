/**
 * SkillUp / Assessment Service — Phase 4
 *
 * Test types are data (TestType), so the college can add categories without a
 * migration. Results are attached to students by enrollment number on upload;
 * unmatched rows are reported back as errors, never silently skipped.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { NotFoundError, ValidationError, ConflictError } from "@/lib/errors";
import { writeAuditLog, type AuditParams } from "./audit.service";
import { notify } from "@/lib/notifications";
import type {
  TestInput,
  UpdateTestInput,
  TestTypeInput,
  BulkResultInput,
} from "@/lib/validations/skillup";

type RequestMeta = Pick<AuditParams, "ipAddress" | "userAgent">;

const TEST_INCLUDE = {
  testType: { select: { id: true, name: true, slug: true } },
  department: { select: { id: true, name: true, code: true } },
  batch: { select: { id: true, name: true, academicYear: true } },
  _count: { select: { results: true, participants: true } },
} satisfies Prisma.TestInclude;

export type TestWithDetails = Prisma.TestGetPayload<{ include: typeof TEST_INCLUDE }>;

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Test types (categories as data) ──────────────────────────────────────────

export async function listTestTypes(includeInactive = false) {
  return prisma.testType.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createTestType(
  data: TestTypeInput,
  createdById: string,
  meta: RequestMeta = {}
) {
  const slug = slugify(data.name);
  const existing = await prisma.testType.findFirst({
    where: { OR: [{ name: data.name }, { slug }] },
    select: { id: true },
  });
  if (existing) throw new ConflictError("A test type with this name already exists");

  const testType = await prisma.testType.create({
    data: {
      name: data.name,
      slug,
      description: data.description ?? null,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
    },
  });

  await writeAuditLog({
    userId: createdById,
    action: "CREATE",
    entity: "TestType",
    entityId: testType.id,
    newValues: { name: testType.name, slug: testType.slug },
    ...meta,
  });

  return testType;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

export async function listTests(filters: {
  testTypeId?: string;
  status?: string;
  batchId?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const where: Prisma.TestWhereInput = {
    ...(filters.testTypeId ? { testTypeId: filters.testTypeId } : {}),
    ...(filters.status ? { status: filters.status as any } : {}),
    ...(filters.batchId ? { batchId: filters.batchId } : {}),
    ...(filters.search
      ? { title: { contains: filters.search, mode: "insensitive" as const } }
      : {}),
  };

  const [tests, total] = await Promise.all([
    prisma.test.findMany({
      where,
      include: TEST_INCLUDE,
      orderBy: { scheduledAt: "desc" },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    }),
    prisma.test.count({ where }),
  ]);

  return { tests, total };
}

export async function getTestById(id: string): Promise<TestWithDetails> {
  const test = await prisma.test.findUnique({ where: { id }, include: TEST_INCLUDE });
  if (!test) throw new NotFoundError("Test not found");
  return test;
}

export async function createTest(
  data: TestInput,
  createdById: string,
  meta: RequestMeta = {}
): Promise<TestWithDetails> {
  const testType = await prisma.testType.findUnique({ where: { id: data.testTypeId } });
  if (!testType) throw new NotFoundError("Test type not found");

  const test = await prisma.test.create({
    data: {
      title: data.title,
      testTypeId: data.testTypeId,
      description: data.description ?? null,
      scheduledAt: data.scheduledAt,
      durationMins: data.durationMins ?? null,
      maxMarks: data.maxMarks,
      passingMarks: data.passingMarks,
      mode: data.mode,
      venue: data.venue ?? null,
      meetingLink: data.meetingLink || null,
      status: data.status,
      departmentId: data.departmentId || null,
      batchId: data.batchId || null,
      createdById,
      ...(data.studentIds && data.studentIds.length > 0
        ? {
            participants: {
              create: data.studentIds.map((studentId) => ({ studentId })),
            },
          }
        : {}),
    },
    include: TEST_INCLUDE,
  });

  await writeAuditLog({
    userId: createdById,
    action: "CREATE",
    entity: "Test",
    entityId: test.id,
    newValues: {
      title: test.title,
      testTypeId: test.testTypeId,
      scheduledAt: test.scheduledAt,
      maxMarks: test.maxMarks,
      batchId: test.batchId,
      departmentId: test.departmentId,
      participants: data.studentIds?.length ?? 0,
    },
    ...meta,
  });

  return test;
}

export async function updateTest(
  id: string,
  data: UpdateTestInput,
  changedById: string,
  meta: RequestMeta = {}
): Promise<TestWithDetails> {
  const before = await prisma.test.findUnique({ where: { id } });
  if (!before) throw new NotFoundError("Test not found");

  const maxMarks = data.maxMarks ?? before.maxMarks;
  const passingMarks = data.passingMarks ?? before.passingMarks;
  if (passingMarks > maxMarks) {
    throw new ValidationError("Passing marks cannot exceed maximum marks");
  }

  const { studentIds, ...rest } = data;
  const test = await prisma.test.update({
    where: { id },
    data: {
      ...rest,
      ...(rest.meetingLink !== undefined ? { meetingLink: rest.meetingLink || null } : {}),
    },
    include: TEST_INCLUDE,
  });

  await writeAuditLog({
    userId: changedById,
    action: "UPDATE",
    entity: "Test",
    entityId: id,
    oldValues: { title: before.title, status: before.status, scheduledAt: before.scheduledAt },
    newValues: { title: test.title, status: test.status, scheduledAt: test.scheduledAt },
    ...meta,
  });

  return test;
}

/**
 * Students in scope for a test: the explicit participant list when present,
 * otherwise everyone matching the department/batch scope.
 */
export async function getEligibleStudents(testId: string) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: { id: true, departmentId: true, batchId: true },
  });
  if (!test) throw new NotFoundError("Test not found");

  const participants = await prisma.testParticipant.findMany({
    where: { testId },
    select: { studentId: true },
  });

  const where: Prisma.StudentWhereInput =
    participants.length > 0
      ? { id: { in: participants.map((p) => p.studentId) } }
      : {
          ...(test.batchId ? { batchId: test.batchId } : {}),
          ...(test.departmentId
            ? { branch: { departmentId: test.departmentId } }
            : {}),
        };

  return prisma.student.findMany({
    where,
    select: {
      id: true,
      enrollmentNumber: true,
      firstName: true,
      lastName: true,
      branch: { select: { code: true } },
      batch: { select: { academicYear: true } },
    },
    orderBy: { enrollmentNumber: "asc" },
  });
}

// ─── Results ──────────────────────────────────────────────────────────────────

export async function listTestResults(testId: string) {
  return prisma.testResult.findMany({
    where: { testId },
    include: {
      student: {
        select: {
          id: true,
          enrollmentNumber: true,
          firstName: true,
          lastName: true,
          branch: { select: { code: true } },
        },
      },
    },
    orderBy: [{ marksObtained: "desc" }],
  });
}

/**
 * Upload results by enrollment number.
 *
 * Rows whose enrollment number doesn't match a student, or that are out of
 * range / duplicated, are returned in `errors` with the row number — the whole
 * upload is rejected unless every row resolves, so nothing is silently skipped.
 */
export async function uploadResults(
  testId: string,
  data: BulkResultInput,
  recordedById: string,
  meta: RequestMeta = {}
): Promise<{
  inserted: number;
  updated: number;
  errors: Array<{ row: number; enrollmentNumber: string; reason: string }>;
}> {
  const test = await prisma.test.findUnique({ where: { id: testId } });
  if (!test) throw new NotFoundError("Test not found");

  const enrollments = data.rows.map((r) => r.enrollmentNumber.trim());
  const students = await prisma.student.findMany({
    where: { enrollmentNumber: { in: enrollments } },
    select: { id: true, enrollmentNumber: true, userId: true },
  });
  const byEnrollment = new Map(students.map((s) => [s.enrollmentNumber, s]));

  const errors: Array<{ row: number; enrollmentNumber: string; reason: string }> = [];
  const seen = new Set<string>();

  data.rows.forEach((row, i) => {
    const enrollment = row.enrollmentNumber.trim();
    const rowNumber = i + 1;

    if (!byEnrollment.has(enrollment)) {
      errors.push({
        row: rowNumber,
        enrollmentNumber: enrollment,
        reason: "No student found with this enrollment number",
      });
      return;
    }
    if (seen.has(enrollment)) {
      errors.push({
        row: rowNumber,
        enrollmentNumber: enrollment,
        reason: "Duplicate row for this student in the same upload",
      });
      return;
    }
    if (row.marksObtained > test.maxMarks) {
      errors.push({
        row: rowNumber,
        enrollmentNumber: enrollment,
        reason: `Marks ${row.marksObtained} exceed the test maximum of ${test.maxMarks}`,
      });
      return;
    }
    if (row.marksObtained < 0 || Number.isNaN(row.marksObtained)) {
      errors.push({
        row: rowNumber,
        enrollmentNumber: enrollment,
        reason: "Marks must be a number of at least 0",
      });
      return;
    }
    seen.add(enrollment);
  });

  // All-or-nothing: a partial import would leave the cohort half-scored.
  if (errors.length > 0) {
    return { inserted: 0, updated: 0, errors };
  }

  const existing = await prisma.testResult.findMany({
    where: { testId, student: { enrollmentNumber: { in: enrollments } } },
    select: { studentId: true },
  });
  const existingIds = new Set(existing.map((e) => e.studentId));

  let inserted = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of data.rows) {
      const student = byEnrollment.get(row.enrollmentNumber.trim())!;
      const percentage = (row.marksObtained / test.maxMarks) * 100;
      const isPassed = row.marksObtained >= test.passingMarks;

      await tx.testResult.upsert({
        where: { testId_studentId: { testId, studentId: student.id } },
        update: {
          marksObtained: row.marksObtained,
          maxMarks: test.maxMarks,
          percentage,
          isPassed,
          remarks: row.remarks ?? null,
          recordedById,
        },
        create: {
          testId,
          studentId: student.id,
          marksObtained: row.marksObtained,
          maxMarks: test.maxMarks,
          percentage,
          isPassed,
          remarks: row.remarks ?? null,
          recordedById,
        },
      });

      existingIds.has(student.id) ? updated++ : inserted++;
    }

    // Rank within the test, highest marks first.
    const all = await tx.testResult.findMany({
      where: { testId },
      orderBy: { marksObtained: "desc" },
      select: { id: true },
    });
    for (let i = 0; i < all.length; i++) {
      await tx.testResult.update({ where: { id: all[i].id }, data: { rank: i + 1 } });
    }
  });

  await writeAuditLog({
    userId: recordedById,
    action: "CREATE",
    entity: "TestResult",
    entityId: testId,
    newValues: { testId, inserted, updated },
    metadata: { enrollmentNumbers: enrollments },
    ...meta,
  });

  // Tell each student their result is available.
  for (const s of students) {
    await notify({
      userId: s.userId,
      subject: `Result published: ${test.title}`,
      message: `Your result for "${test.title}" is now available in the SkillUp centre.`,
      template: "skillup_result",
      channels: ["in_app", "email"],
      priority: "normal",
      category: "skillup",
      entityType: "test",
      entityId: test.id,
      link: `/student/skillup/${test.id}`,
      data: { testTitle: test.title },
    });
  }

  return { inserted, updated, errors };
}

// ─── Student-facing ───────────────────────────────────────────────────────────

export async function getStudentPerformance(studentId: string) {
  const results = await prisma.testResult.findMany({
    where: { studentId },
    include: {
      test: {
        include: { testType: { select: { id: true, name: true, slug: true } } },
      },
    },
    orderBy: { test: { scheduledAt: "desc" } },
  });

  // Breakdown by category — driven by TestType rows, not a hardcoded list.
  const byCategory = new Map<
    string,
    { typeId: string; name: string; slug: string; count: number; totalPct: number; passed: number; best: number }
  >();

  for (const r of results) {
    const t = r.test.testType;
    const entry = byCategory.get(t.id) ?? {
      typeId: t.id,
      name: t.name,
      slug: t.slug,
      count: 0,
      totalPct: 0,
      passed: 0,
      best: 0,
    };
    entry.count++;
    entry.totalPct += r.percentage;
    if (r.isPassed) entry.passed++;
    entry.best = Math.max(entry.best, r.percentage);
    byCategory.set(t.id, entry);
  }

  const categories = [...byCategory.values()].map((c) => ({
    typeId: c.typeId,
    name: c.name,
    slug: c.slug,
    testsTaken: c.count,
    averagePercentage: Number((c.totalPct / c.count).toFixed(2)),
    bestPercentage: Number(c.best.toFixed(2)),
    passRate: Number(((c.passed / c.count) * 100).toFixed(2)),
  }));

  const overallAverage =
    results.length > 0
      ? Number(
          (results.reduce((sum, r) => sum + r.percentage, 0) / results.length).toFixed(2)
        )
      : null;

  return {
    overallAverage,
    testsTaken: results.length,
    passed: results.filter((r) => r.isPassed).length,
    categories,
    history: results.map((r) => ({
      id: r.id,
      testId: r.testId,
      title: r.test.title,
      category: r.test.testType.name,
      scheduledAt: r.test.scheduledAt,
      marksObtained: r.marksObtained,
      maxMarks: r.maxMarks,
      percentage: Number(r.percentage.toFixed(2)),
      isPassed: r.isPassed,
      rank: r.rank,
    })),
  };
}

/** Detailed single-test view for a student, including cohort context. */
export async function getStudentTestResult(studentId: string, testId: string) {
  const result = await prisma.testResult.findUnique({
    where: { testId_studentId: { testId, studentId } },
    include: {
      test: { include: { testType: true } },
    },
  });
  if (!result) throw new NotFoundError("No result found for this test");

  const agg = await prisma.testResult.aggregate({
    where: { testId },
    _avg: { percentage: true },
    _max: { percentage: true },
    _count: true,
  });

  return {
    id: result.id,
    test: {
      id: result.test.id,
      title: result.test.title,
      category: result.test.testType.name,
      description: result.test.description,
      scheduledAt: result.test.scheduledAt,
      durationMins: result.test.durationMins,
      passingMarks: result.test.passingMarks,
    },
    marksObtained: result.marksObtained,
    maxMarks: result.maxMarks,
    percentage: Number(result.percentage.toFixed(2)),
    isPassed: result.isPassed,
    rank: result.rank,
    remarks: result.remarks,
    cohort: {
      candidates: agg._count,
      averagePercentage: agg._avg.percentage ? Number(agg._avg.percentage.toFixed(2)) : null,
      topPercentage: agg._max.percentage ? Number(agg._max.percentage.toFixed(2)) : null,
    },
  };
}

/**
 * Average SkillUp percentage for a student, optionally restricted to one
 * TestType slug. Used by the eligibility engine.
 */
export async function getSkillUpScore(
  studentId: string,
  testTypeSlug?: string
): Promise<number | null> {
  const agg = await prisma.testResult.aggregate({
    where: {
      studentId,
      ...(testTypeSlug ? { test: { testType: { slug: testTypeSlug } } } : {}),
    },
    _avg: { percentage: true },
  });
  return agg._avg.percentage ?? null;
}
