/**
 * Mock Interview Service — Phase 4
 *
 * Manual faculty/admin entry only. AIService.mockInterviewFeedback() stays
 * unimplemented until Phase 5 — nothing here calls it.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { writeAuditLog, type AuditParams } from "./audit.service";
import { notify } from "@/lib/notifications";
import type {
  MockInterviewInput,
  UpdateMockInterviewInput,
  InterviewResultInput,
} from "@/lib/validations/interview";

type RequestMeta = Pick<AuditParams, "ipAddress" | "userAgent">;

const INTERVIEW_INCLUDE = {
  student: {
    select: {
      id: true,
      enrollmentNumber: true,
      firstName: true,
      lastName: true,
      branch: { select: { code: true } },
      batch: { select: { academicYear: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  },
  result: true,
} satisfies Prisma.MockInterviewInclude;

export type MockInterviewWithDetails = Prisma.MockInterviewGetPayload<{
  include: typeof INTERVIEW_INCLUDE;
}>;

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listMockInterviews(filters: {
  studentId?: string;
  status?: string;
  type?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const where: Prisma.MockInterviewWhereInput = {
    ...(filters.studentId ? { studentId: filters.studentId } : {}),
    ...(filters.status ? { status: filters.status as any } : {}),
    ...(filters.type ? { type: filters.type as any } : {}),
    ...(filters.search
      ? {
          OR: [
            { student: { enrollmentNumber: { contains: filters.search, mode: "insensitive" } } },
            { student: { firstName: { contains: filters.search, mode: "insensitive" } } },
            { student: { lastName: { contains: filters.search, mode: "insensitive" } } },
            { interviewerName: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [interviews, total] = await Promise.all([
    prisma.mockInterview.findMany({
      where,
      include: INTERVIEW_INCLUDE,
      orderBy: { scheduledAt: "desc" },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    }),
    prisma.mockInterview.count({ where }),
  ]);

  return { interviews, total };
}

export async function getMockInterviewById(
  id: string
): Promise<MockInterviewWithDetails> {
  const interview = await prisma.mockInterview.findUnique({
    where: { id },
    include: INTERVIEW_INCLUDE,
  });
  if (!interview) throw new NotFoundError("Mock interview not found");
  return interview;
}

/** Student-facing history — always scoped to one student. */
export async function listInterviewsForStudent(studentId: string) {
  return prisma.mockInterview.findMany({
    where: { studentId },
    include: INTERVIEW_INCLUDE,
    orderBy: { scheduledAt: "desc" },
  });
}

export async function getStudentInterviewSummary(studentId: string) {
  const interviews = await prisma.mockInterview.findMany({
    where: { studentId },
    include: { result: true },
  });

  const scored = interviews.filter((i) => i.result);
  const avg = (pick: (r: NonNullable<(typeof scored)[number]["result"]>) => number | null) => {
    const vals = scored.map((i) => pick(i.result!)).filter((v): v is number => v != null);
    return vals.length
      ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
      : null;
  };

  return {
    total: interviews.length,
    completed: interviews.filter((i) => i.status === "COMPLETED").length,
    scored: scored.length,
    averages: {
      overall: avg((r) => r.overallScore),
      technical: avg((r) => r.technicalScore),
      communication: avg((r) => r.communicationScore),
      confidence: avg((r) => r.confidenceScore),
      problemSolving: avg((r) => r.problemSolvingScore),
      hr: avg((r) => r.hrScore),
    },
  };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createMockInterview(
  data: MockInterviewInput,
  createdById: string,
  meta: RequestMeta = {}
): Promise<MockInterviewWithDetails> {
  const student = await prisma.student.findUnique({
    where: { id: data.studentId },
    select: { id: true, userId: true },
  });
  if (!student) throw new NotFoundError("Student not found");

  const interview = await prisma.mockInterview.create({
    data: {
      studentId: data.studentId,
      interviewerName: data.interviewerName,
      interviewerId: data.interviewerId || null,
      scheduledAt: data.scheduledAt,
      durationMins: data.durationMins ?? null,
      targetRole: data.targetRole ?? null,
      type: data.type,
      mode: data.mode,
      venue: data.venue ?? null,
      meetingLink: data.meetingLink || null,
      status: data.status,
      createdById,
    },
    include: INTERVIEW_INCLUDE,
  });

  await writeAuditLog({
    userId: createdById,
    action: "CREATE",
    entity: "MockInterview",
    entityId: interview.id,
    newValues: {
      studentId: interview.studentId,
      interviewerName: interview.interviewerName,
      scheduledAt: interview.scheduledAt,
      type: interview.type,
      status: interview.status,
    },
    ...meta,
  });

  await notify({
    userId: student.userId,
    subject: `Mock interview scheduled: ${interview.targetRole ?? interview.type}`,
    message: `A mock interview with ${interview.interviewerName} has been scheduled.`,
    template: "test_scheduled",
    channels: ["in_app", "email"],
    priority: "normal",
    category: "interview",
    entityType: "mockInterview",
    entityId: interview.id,
    link: "/student/mock-interviews",
    data: {
      eventTitle: `Mock interview (${interview.type})`,
      date: interview.scheduledAt.toLocaleDateString(),
      time: interview.scheduledAt.toLocaleTimeString(),
      venue: interview.venue ?? interview.meetingLink ?? "To be announced",
      instructions: interview.targetRole
        ? `Target role: ${interview.targetRole}`
        : "",
      interviewer: interview.interviewerName,
    },
  });

  return interview;
}

export async function updateMockInterview(
  id: string,
  data: UpdateMockInterviewInput,
  changedById: string,
  meta: RequestMeta = {}
): Promise<MockInterviewWithDetails> {
  const before = await prisma.mockInterview.findUnique({ where: { id } });
  if (!before) throw new NotFoundError("Mock interview not found");

  const interview = await prisma.mockInterview.update({
    where: { id },
    data: {
      ...data,
      ...(data.meetingLink !== undefined ? { meetingLink: data.meetingLink || null } : {}),
      ...(data.interviewerId !== undefined
        ? { interviewerId: data.interviewerId || null }
        : {}),
    },
    include: INTERVIEW_INCLUDE,
  });

  await writeAuditLog({
    userId: changedById,
    action: "UPDATE",
    entity: "MockInterview",
    entityId: id,
    oldValues: { status: before.status, scheduledAt: before.scheduledAt },
    newValues: { status: interview.status, scheduledAt: interview.scheduledAt },
    ...meta,
  });

  return interview;
}

/**
 * Record (or re-record) the scorecard. Marks the interview COMPLETED and
 * notifies the student that feedback is available.
 */
export async function recordInterviewResult(
  mockInterviewId: string,
  data: InterviewResultInput,
  recordedById: string,
  meta: RequestMeta = {}
): Promise<MockInterviewWithDetails> {
  const interview = await prisma.mockInterview.findUnique({
    where: { id: mockInterviewId },
    include: { student: { select: { userId: true } } },
  });
  if (!interview) throw new NotFoundError("Mock interview not found");

  const componentScores = [
    data.technicalScore,
    data.communicationScore,
    data.confidenceScore,
    data.problemSolvingScore,
    data.hrScore,
  ].filter((v): v is number => v != null);

  const overallScore =
    data.overallScore ??
    (componentScores.length > 0
      ? Number(
          (componentScores.reduce((a, b) => a + b, 0) / componentScores.length).toFixed(2)
        )
      : null);

  if (overallScore == null) {
    throw new ValidationError(
      "Provide an overall score, or at least one component score to average from"
    );
  }

  const payload = {
    technicalScore: data.technicalScore ?? null,
    communicationScore: data.communicationScore ?? null,
    confidenceScore: data.confidenceScore ?? null,
    problemSolvingScore: data.problemSolvingScore ?? null,
    hrScore: data.hrScore ?? null,
    overallScore,
    feedback: data.feedback ?? null,
    strengths: data.strengths,
    weaknesses: data.weaknesses,
    improvementSuggestions: data.improvementSuggestions,
    recordedById,
  };

  await prisma.$transaction(async (tx) => {
    await tx.interviewResult.upsert({
      where: { mockInterviewId },
      update: payload,
      create: { mockInterviewId, ...payload },
    });
    await tx.mockInterview.update({
      where: { id: mockInterviewId },
      data: { status: "COMPLETED" },
    });
  });

  await writeAuditLog({
    userId: recordedById,
    action: "CREATE",
    entity: "InterviewResult",
    entityId: mockInterviewId,
    newValues: { overallScore, studentId: interview.studentId },
    ...meta,
  });

  await notify({
    userId: interview.student.userId,
    subject: "Your mock interview feedback is ready",
    message: `Feedback for your mock interview with ${interview.interviewerName} is now available (overall ${overallScore}/10).`,
    template: "interview_feedback",
    channels: ["in_app", "email"],
    priority: "normal",
    category: "interview",
    entityType: "mockInterview",
    entityId: mockInterviewId,
    link: "/student/mock-interviews",
    data: {
      overallScore: String(overallScore),
      interviewer: interview.interviewerName,
    },
  });

  return getMockInterviewById(mockInterviewId);
}
