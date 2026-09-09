/**
 * Placement Calendar — Phase 4
 *
 * Most calendar entries already exist as rounds, tests, interviews or drive
 * deadlines, so those are *projected* from their source tables rather than
 * duplicated into CalendarEvent. CalendarEvent holds standalone entries only.
 *
 * Student scoping is enforced here, in the query — not in the UI. A student
 * sees an event only if it belongs to them (their round, their test, their
 * interview) or targets their batch/department.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";
import { writeAuditLog, type AuditParams } from "./audit.service";

type RequestMeta = Pick<AuditParams, "ipAddress" | "userAgent">;

export interface CalendarItem {
  id: string;
  source: "event" | "round" | "test" | "interview" | "drive" | "ppt";
  type: string;
  title: string;
  description?: string | null;
  startAt: Date;
  endAt?: Date | null;
  venue?: string | null;
  meetingLink?: string | null;
  link?: string | null;
  entityId?: string | null;
}

export interface CalendarRange {
  from?: Date;
  to?: Date;
}

function withinRange(range: CalendarRange): Prisma.DateTimeFilter | undefined {
  if (!range.from && !range.to) return undefined;
  return {
    ...(range.from ? { gte: range.from } : {}),
    ...(range.to ? { lte: range.to } : {}),
  };
}

// ─── Student view ─────────────────────────────────────────────────────────────

/**
 * Everything a single student may see. Each source is filtered by that
 * student's own records or their batch/department.
 */
export async function getStudentCalendar(
  studentId: string,
  range: CalendarRange = {}
): Promise<CalendarItem[]> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, batchId: true, branch: { select: { departmentId: true } } },
  });
  if (!student) throw new NotFoundError("Student not found");

  const departmentId = student.branch?.departmentId ?? null;
  const dateFilter = withinRange(range);

  const [rounds, tests, interviews, drives, events, talks] = await Promise.all([
    // Rounds the student is actually a participant in.
    prisma.placementRound.findMany({
      where: {
        ...(dateFilter ? { scheduledAt: dateFilter } : { scheduledAt: { not: null } }),
        participants: { some: { application: { studentId } } },
      },
      select: {
        id: true,
        title: true,
        type: true,
        scheduledAt: true,
        durationMins: true,
        venue: true,
        meetingLink: true,
        drive: { select: { id: true, company: { select: { name: true } } } },
      },
    }),

    // Tests in scope: explicit participant, or matching batch/department scope.
    prisma.test.findMany({
      where: {
        status: { in: ["SCHEDULED", "COMPLETED"] },
        ...(dateFilter ? { scheduledAt: dateFilter } : {}),
        OR: [
          { participants: { some: { studentId } } },
          {
            AND: [
              { participants: { none: {} } },
              {
                OR: [
                  { batchId: student.batchId },
                  { AND: [{ batchId: null }, { departmentId: null }] },
                  ...(departmentId ? [{ departmentId }] : []),
                ],
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        durationMins: true,
        venue: true,
        meetingLink: true,
        testType: { select: { name: true } },
      },
    }),

    // The student's own mock interviews.
    prisma.mockInterview.findMany({
      where: {
        studentId,
        status: { in: ["SCHEDULED", "COMPLETED"] },
        ...(dateFilter ? { scheduledAt: dateFilter } : {}),
      },
      select: {
        id: true,
        scheduledAt: true,
        durationMins: true,
        venue: true,
        meetingLink: true,
        type: true,
        targetRole: true,
        interviewerName: true,
      },
    }),

    // Application deadlines for drives the student has applied to.
    prisma.placementDrive.findMany({
      where: {
        applications: { some: { studentId } },
        applicationCloseAt: dateFilter ?? { not: null },
      },
      select: {
        id: true,
        title: true,
        applicationCloseAt: true,
        company: { select: { name: true } },
      },
    }),

    // Standalone events targeting this student's batch/department, or everyone.
    prisma.calendarEvent.findMany({
      where: {
        ...(dateFilter ? { startAt: dateFilter } : {}),
        OR: [
          { AND: [{ batchId: null }, { departmentId: null }] },
          { batchId: student.batchId },
          ...(departmentId ? [{ departmentId }] : []),
        ],
      },
    }),

    // Pre-placement talks for drives the student can see (applied or open).
    prisma.prePlacementTalk.findMany({
      where: {
        ...(dateFilter ? { scheduledAt: dateFilter } : {}),
        drive: {
          OR: [
            { applications: { some: { studentId } } },
            { status: { in: ["PUBLISHED", "APPLICATIONS_OPEN"] } },
          ],
        },
      },
      include: {
        drive: { select: { id: true, title: true, company: { select: { name: true } } } },
      },
    }),
  ]);

  return [
    ...mapRounds(rounds),
    ...mapTests(tests),
    ...mapInterviews(interviews),
    ...mapDriveDeadlines(drives),
    ...mapEvents(events),
    ...mapTalks(talks),
  ].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

// ─── Admin view ───────────────────────────────────────────────────────────────

/** Everything, unscoped — staff only. */
export async function getAdminCalendar(
  range: CalendarRange = {}
): Promise<CalendarItem[]> {
  const dateFilter = withinRange(range);

  const [rounds, tests, interviews, drives, events, talks] = await Promise.all([
    prisma.placementRound.findMany({
      where: dateFilter ? { scheduledAt: dateFilter } : { scheduledAt: { not: null } },
      select: {
        id: true,
        title: true,
        type: true,
        scheduledAt: true,
        durationMins: true,
        venue: true,
        meetingLink: true,
        drive: { select: { id: true, company: { select: { name: true } } } },
      },
    }),
    prisma.test.findMany({
      where: dateFilter ? { scheduledAt: dateFilter } : {},
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        durationMins: true,
        venue: true,
        meetingLink: true,
        testType: { select: { name: true } },
      },
    }),
    prisma.mockInterview.findMany({
      where: dateFilter ? { scheduledAt: dateFilter } : {},
      select: {
        id: true,
        scheduledAt: true,
        durationMins: true,
        venue: true,
        meetingLink: true,
        type: true,
        targetRole: true,
        interviewerName: true,
      },
    }),
    prisma.placementDrive.findMany({
      where: { applicationCloseAt: dateFilter ?? { not: null } },
      select: {
        id: true,
        title: true,
        applicationCloseAt: true,
        company: { select: { name: true } },
      },
    }),
    prisma.calendarEvent.findMany({
      where: dateFilter ? { startAt: dateFilter } : {},
    }),
    prisma.prePlacementTalk.findMany({
      where: dateFilter ? { scheduledAt: dateFilter } : {},
      include: {
        drive: { select: { id: true, title: true, company: { select: { name: true } } } },
      },
    }),
  ]);

  return [
    ...mapRounds(rounds),
    ...mapTests(tests),
    ...mapInterviews(interviews),
    ...mapDriveDeadlines(drives),
    ...mapEvents(events),
    ...mapTalks(talks),
  ].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

// ─── Projection helpers ───────────────────────────────────────────────────────

const ROUND_TYPE_TO_EVENT: Record<string, string> = {
  APTITUDE_TEST: "APTITUDE_TEST",
  CODING_TEST: "CODING_TEST",
  WRITTEN_TEST: "APTITUDE_TEST",
  TECHNICAL_INTERVIEW: "TECHNICAL_INTERVIEW",
  HR_INTERVIEW: "HR_INTERVIEW",
};

function addMinutes(d: Date, mins?: number | null) {
  return mins ? new Date(d.getTime() + mins * 60_000) : null;
}

function mapRounds(rows: any[]): CalendarItem[] {
  return rows
    .filter((r) => r.scheduledAt)
    .map((r) => ({
      id: `round:${r.id}`,
      source: "round" as const,
      type: ROUND_TYPE_TO_EVENT[r.type] ?? "DRIVE_VISIT",
      title: `${r.drive.company.name} — ${r.title}`,
      startAt: r.scheduledAt!,
      endAt: addMinutes(r.scheduledAt!, r.durationMins),
      venue: r.venue,
      meetingLink: r.meetingLink,
      link: `/student/journey`,
      entityId: r.id,
    }));
}

function mapTests(rows: any[]): CalendarItem[] {
  return rows.map((t) => ({
    id: `test:${t.id}`,
    source: "test" as const,
    type: "SKILLUP_TEST",
    title: `${t.testType.name}: ${t.title}`,
    startAt: t.scheduledAt,
    endAt: addMinutes(t.scheduledAt, t.durationMins),
    venue: t.venue,
    meetingLink: t.meetingLink,
    link: `/student/skillup/${t.id}`,
    entityId: t.id,
  }));
}

function mapInterviews(rows: any[]): CalendarItem[] {
  return rows.map((i) => ({
    id: `interview:${i.id}`,
    source: "interview" as const,
    type: "MOCK_INTERVIEW",
    title: `Mock interview — ${i.targetRole ?? i.type}`,
    description: `Interviewer: ${i.interviewerName}`,
    startAt: i.scheduledAt,
    endAt: addMinutes(i.scheduledAt, i.durationMins),
    venue: i.venue,
    meetingLink: i.meetingLink,
    link: "/student/mock-interviews",
    entityId: i.id,
  }));
}

function mapDriveDeadlines(rows: any[]): CalendarItem[] {
  return rows
    .filter((d) => d.applicationCloseAt)
    .map((d) => ({
      id: `drive:${d.id}`,
      source: "drive" as const,
      type: "APPLICATION_DEADLINE",
      title: `Applications close — ${d.company.name}`,
      description: d.title,
      startAt: d.applicationCloseAt!,
      endAt: null,
      venue: null,
      meetingLink: null,
      link: `/student/opportunities/${d.id}`,
      entityId: d.id,
    }));
}

function mapEvents(rows: any[]): CalendarItem[] {
  return rows.map((e) => ({
    id: `event:${e.id}`,
    source: "event" as const,
    type: e.type,
    title: e.title,
    description: e.description,
    startAt: e.startAt,
    endAt: e.endAt,
    venue: e.venue,
    meetingLink: e.meetingLink,
    link: e.driveId ? `/student/opportunities/${e.driveId}` : null,
    entityId: e.id,
  }));
}

function mapTalks(rows: any[]): CalendarItem[] {
  return rows.map((t) => ({
    id: `ppt:${t.id}`,
    source: "ppt" as const,
    type: "PRE_PLACEMENT_TALK",
    title: `Pre-placement talk — ${t.drive.company.name}`,
    description: t.instructions,
    startAt: t.scheduledAt,
    endAt: addMinutes(t.scheduledAt, t.durationMins),
    venue: t.venue,
    meetingLink: t.meetingLink,
    link: `/student/opportunities/${t.drive.id}`,
    entityId: t.id,
  }));
}

// ─── Standalone event CRUD ────────────────────────────────────────────────────

export async function createCalendarEvent(
  data: {
    title: string;
    type: string;
    description?: string | null;
    startAt: Date;
    endAt?: Date | null;
    venue?: string | null;
    meetingLink?: string | null;
    driveId?: string | null;
    departmentId?: string | null;
    batchId?: string | null;
  },
  createdById: string,
  meta: RequestMeta = {}
) {
  const event = await prisma.calendarEvent.create({
    data: {
      title: data.title,
      type: data.type as any,
      description: data.description ?? null,
      startAt: data.startAt,
      endAt: data.endAt ?? null,
      venue: data.venue ?? null,
      meetingLink: data.meetingLink || null,
      driveId: data.driveId || null,
      departmentId: data.departmentId || null,
      batchId: data.batchId || null,
      createdById,
    },
  });

  await writeAuditLog({
    userId: createdById,
    action: "CREATE",
    entity: "CalendarEvent",
    entityId: event.id,
    newValues: { title: event.title, type: event.type, startAt: event.startAt },
    ...meta,
  });

  return event;
}

export async function updateCalendarEvent(
  id: string,
  data: Partial<{
    title: string;
    type: string;
    description: string | null;
    startAt: Date;
    endAt: Date | null;
    venue: string | null;
    meetingLink: string | null;
    departmentId: string | null;
    batchId: string | null;
  }>,
  changedById: string,
  meta: RequestMeta = {}
) {
  const before = await prisma.calendarEvent.findUnique({ where: { id } });
  if (!before) throw new NotFoundError("Event not found");

  const event = await prisma.calendarEvent.update({
    where: { id },
    data: { ...(data as any) },
  });

  await writeAuditLog({
    userId: changedById,
    action: "UPDATE",
    entity: "CalendarEvent",
    entityId: id,
    oldValues: { title: before.title, startAt: before.startAt },
    newValues: { title: event.title, startAt: event.startAt },
    ...meta,
  });

  return event;
}

export async function deleteCalendarEvent(
  id: string,
  deletedById: string,
  meta: RequestMeta = {}
) {
  const before = await prisma.calendarEvent.findUnique({ where: { id } });
  if (!before) throw new NotFoundError("Event not found");

  await prisma.calendarEvent.delete({ where: { id } });

  await writeAuditLog({
    userId: deletedById,
    action: "DELETE",
    entity: "CalendarEvent",
    entityId: id,
    oldValues: { title: before.title, startAt: before.startAt },
    ...meta,
  });
}

// ─── Pre-placement talk ───────────────────────────────────────────────────────

export async function getPrePlacementTalk(driveId: string) {
  return prisma.prePlacementTalk.findUnique({ where: { driveId } });
}

export async function upsertPrePlacementTalk(
  driveId: string,
  data: {
    scheduledAt: Date;
    durationMins?: number | null;
    venue?: string | null;
    meetingLink?: string | null;
    instructions?: string | null;
    faq?: string | null;
    attachmentKeys?: string[];
  },
  createdById: string,
  meta: RequestMeta = {}
) {
  const drive = await prisma.placementDrive.findUnique({
    where: { id: driveId },
    select: { id: true },
  });
  if (!drive) throw new NotFoundError("Drive not found");

  const payload = {
    scheduledAt: data.scheduledAt,
    durationMins: data.durationMins ?? null,
    venue: data.venue ?? null,
    meetingLink: data.meetingLink || null,
    instructions: data.instructions ?? null,
    faq: data.faq ?? null,
    ...(data.attachmentKeys ? { attachmentKeys: data.attachmentKeys } : {}),
  };

  const before = await prisma.prePlacementTalk.findUnique({ where: { driveId } });

  const talk = await prisma.prePlacementTalk.upsert({
    where: { driveId },
    update: payload,
    create: { driveId, createdById, attachmentKeys: [], ...payload },
  });

  await writeAuditLog({
    userId: createdById,
    action: before ? "UPDATE" : "CREATE",
    entity: "PrePlacementTalk",
    entityId: talk.id,
    newValues: { driveId, scheduledAt: talk.scheduledAt, venue: talk.venue },
    ...meta,
  });

  return talk;
}

/** Append an uploaded attachment key (deck / JD) to the talk. */
export async function addTalkAttachment(
  driveId: string,
  key: string,
  changedById: string,
  meta: RequestMeta = {}
) {
  const talk = await prisma.prePlacementTalk.findUnique({ where: { driveId } });
  if (!talk) throw new NotFoundError("Schedule the pre-placement talk first");

  const updated = await prisma.prePlacementTalk.update({
    where: { driveId },
    data: { attachmentKeys: [...talk.attachmentKeys, key] },
  });

  await writeAuditLog({
    userId: changedById,
    action: "UPDATE",
    entity: "PrePlacementTalk",
    entityId: talk.id,
    newValues: { attachmentAdded: key },
    ...meta,
  });

  return updated;
}
