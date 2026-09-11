/**
 * Notification dispatcher — Phase 4
 *
 * Persists in-app notifications and sends templated email. Recipients can be
 * given as user ids, *student* ids, or a role filter.
 *
 * Note on ids: the placement services naturally hold `Student.id`, so the
 * payload accepts `studentId`/`studentIds` and resolves them to the owning
 * User. Passing a Student.id as `userId` is the bug this split prevents.
 */

import { prisma } from "@/lib/prisma";
import { sendEmail, interpolateTemplate } from "@/lib/email";
import { getBuiltInTemplate } from "@/lib/email/templates";
import type { NotificationPriority as PrismaPriority } from "@prisma/client";

export type NotificationChannel = "email" | "sms" | "push" | "in_app";
export type NotificationPriority = "low" | "normal" | "high" | "critical";

export interface NotificationPayload {
  // Recipients — any combination; the union is de-duplicated.
  userId?: string;
  userIds?: string[];
  studentId?: string;
  studentIds?: string[];
  roleFilter?: string[];

  // Content
  subject: string;
  message: string;
  /** EmailTemplate key; falls back to "generic". */
  template?: string;
  data?: Record<string, string | number | null | undefined>;

  // Delivery
  channels: NotificationChannel[];
  priority: NotificationPriority;
  scheduledAt?: Date;

  // Context
  category: string;
  entityType?: string;
  entityId?: string;
  /** Deep link into the portal. Also accepted via `data.link`. */
  link?: string;
}

const PRIORITY_MAP: Record<NotificationPriority, PrismaPriority> = {
  low: "LOW",
  normal: "NORMAL",
  high: "HIGH",
  critical: "CRITICAL",
};

type Recipient = { id: string; email: string; name: string };

async function resolveRecipients(p: NotificationPayload): Promise<Recipient[]> {
  const userIds = new Set<string>();
  if (p.userId) userIds.add(p.userId);
  p.userIds?.forEach((id) => userIds.add(id));

  const studentIds = [
    ...(p.studentId ? [p.studentId] : []),
    ...(p.studentIds ?? []),
  ];
  if (studentIds.length > 0) {
    const students = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { userId: true },
    });
    students.forEach((s) => userIds.add(s.userId));
  }

  const where =
    p.roleFilter && p.roleFilter.length > 0
      ? {
          isActive: true,
          OR: [
            { role: { in: p.roleFilter as any } },
            ...(userIds.size > 0 ? [{ id: { in: [...userIds] } }] : []),
          ],
        }
      : { isActive: true, id: { in: [...userIds] } };

  if (userIds.size === 0 && !(p.roleFilter && p.roleFilter.length > 0)) return [];

  const users = await prisma.user.findMany({
    where,
    select: { id: true, email: true, name: true },
  });
  return users;
}

/**
 * Resolve a template: an admin-edited EmailTemplate row wins over the built-in
 * default of the same key. Inactive overrides fall back to the built-in.
 */
async function resolveTemplate(key: string) {
  const builtIn = getBuiltInTemplate(key) ?? getBuiltInTemplate("generic")!;
  try {
    const override = await prisma.emailTemplate.findUnique({ where: { key } });
    if (override && override.isActive) {
      return {
        subject: override.subject,
        bodyHtml: override.bodyHtml,
        variables: override.variables.length > 0 ? override.variables : builtIn.variables,
      };
    }
  } catch {
    // Fall through to the built-in if the lookup fails.
  }
  return { subject: builtIn.subject, bodyHtml: builtIn.bodyHtml, variables: builtIn.variables };
}

/** Render the email body for one recipient. */
async function renderEmail(p: NotificationPayload, recipient: Recipient) {
  const template = await resolveTemplate(p.template ?? "generic");
  const vars: Record<string, string> = {
    studentName: recipient.name,
    subject: p.subject,
    message: p.message,
    link: absoluteUrl(p.link ?? (p.data?.link as string | undefined)),
    portalUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  };
  for (const [k, v] of Object.entries(p.data ?? {})) {
    if (v != null) vars[k] = String(v);
  }
  // Any placeholder we have no value for renders empty rather than "{{x}}".
  for (const name of template.variables) {
    if (!(name in vars)) vars[name] = "";
  }

  return {
    subject: interpolateTemplate(template.subject, vars),
    html: interpolateTemplate(template.bodyHtml, vars),
    text: `${interpolateTemplate(template.subject, vars)}\n\n${p.message}`,
  };
}

function absoluteUrl(path?: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  if (!path) return base;
  return path.startsWith("http") ? path : `${base}${path}`;
}

/**
 * Fan a notification out to its channels. Never throws — a delivery failure
 * must not roll back the business operation that triggered it.
 */
export async function notify(payload: NotificationPayload): Promise<void> {
  try {
    const recipients = await resolveRecipients(payload);
    if (recipients.length === 0) return;

    const link = payload.link ?? (payload.data?.link as string | undefined) ?? null;

    if (payload.channels.includes("in_app")) {
      await prisma.notification.createMany({
        data: recipients.map((r) => ({
          userId: r.id,
          subject: payload.subject,
          message: payload.message,
          category: payload.category,
          priority: PRIORITY_MAP[payload.priority],
          link,
          entityType: payload.entityType ?? null,
          entityId: payload.entityId ?? null,
        })),
      });
    }

    if (payload.channels.includes("email")) {
      // Sent individually so one bad address can't sink the batch.
      await Promise.allSettled(
        recipients.map(async (r) => {
          const { subject, html, text } = await renderEmail(payload, r);
          await sendEmail({ to: r.email, subject, html, text });
        })
      );
    }

    // sms / push have no provider configured yet.
  } catch (error) {
    console.error("[NOTIFICATION_ERROR]", {
      error: error instanceof Error ? error.message : "Unknown error",
      category: payload.category,
      subject: payload.subject,
    });
  }
}

// ─── Pre-built notification helpers ───────────────────────────────────────────
// These take *student* ids — that is what the placement services hold.

export const PlacementNotifications = {
  drivePublished: (driveId: string, companyName: string, title: string) =>
    notify({
      category: "placement",
      entityType: "drive",
      entityId: driveId,
      template: "new_opportunity",
      subject: `New Opportunity: ${title}`,
      message: `${companyName} has published a new placement drive: ${title}.`,
      data: { companyName, roleTitle: title, link: `/student/opportunities/${driveId}` },
      channels: ["email", "in_app"],
      priority: "high",
      roleFilter: ["STUDENT"],
    }),

  applicationsClosing: (driveId: string, title: string, closeAt: Date) =>
    notify({
      category: "placement",
      entityType: "drive",
      entityId: driveId,
      template: "deadline_reminder",
      subject: `Last Chance: ${title}`,
      message: `Applications for ${title} close on ${closeAt.toLocaleDateString()}.`,
      data: {
        roleTitle: title,
        deadline: closeAt.toLocaleString(),
        link: `/student/opportunities/${driveId}`,
      },
      channels: ["email", "in_app"],
      priority: "high",
      roleFilter: ["STUDENT"],
    }),

  applicationReceived: (studentId: string, companyName: string, title: string) =>
    notify({
      category: "placement",
      entityType: "application",
      studentId,
      template: "application_confirmation",
      subject: `Application Received: ${title}`,
      message: `Your application for ${title} at ${companyName} has been received.`,
      data: {
        companyName,
        roleTitle: title,
        appliedAt: new Date().toLocaleString(),
        link: "/student/applications",
      },
      channels: ["email", "in_app"],
      priority: "normal",
    }),

  statusChanged: (studentId: string, companyName: string, title: string, newStatus: string) =>
    notify({
      category: "placement",
      entityType: "application",
      studentId,
      template: "round_result",
      subject: `Update: ${title}`,
      message: `Your application status for ${title} at ${companyName} is now ${newStatus}.`,
      data: {
        companyName,
        roundTitle: title,
        result: newStatus,
        link: "/student/applications",
      },
      channels: ["email", "in_app"],
      priority: "high",
    }),

  shortlisted: (studentId: string, companyName: string, title: string, nextRound?: string) =>
    notify({
      category: "placement",
      entityType: "application",
      studentId,
      template: "shortlisted",
      subject: `Shortlisted: ${title}`,
      message: `You have been shortlisted for ${title} at ${companyName}.`,
      data: {
        companyName,
        roleTitle: title,
        nextRound: nextRound ? `Next: ${nextRound}` : "",
        link: "/student/applications",
      },
      channels: ["email", "in_app"],
      priority: "high",
    }),

  roundScheduled: (
    studentIds: string[],
    companyName: string,
    roundTitle: string,
    scheduledAt: Date,
    venue?: string
  ) =>
    notify({
      category: "placement",
      entityType: "round",
      studentIds,
      template: "next_round",
      subject: `Round Scheduled: ${roundTitle}`,
      message: `${roundTitle} for ${companyName} is scheduled for ${scheduledAt.toLocaleString()}.`,
      data: {
        companyName,
        roundTitle,
        date: scheduledAt.toLocaleDateString(),
        time: scheduledAt.toLocaleTimeString(),
        venue: venue ?? "To be announced",
        link: "/student/journey",
      },
      channels: ["email", "in_app"],
      priority: "high",
    }),

  attendanceMarked: (
    studentId: string,
    roundTitle: string,
    companyName: string,
    status: string
  ) =>
    notify({
      category: "placement",
      entityType: "round",
      studentId,
      template: "attendance_status",
      subject: `Attendance recorded for ${roundTitle}`,
      message: `Your attendance for ${roundTitle} was recorded as ${status}.`,
      data: { roundTitle, companyName, attendanceStatus: status, link: "/student/journey" },
      channels: ["in_app", "email"],
      priority: "normal",
    }),

  selected: (studentId: string, companyName: string, title: string) =>
    notify({
      category: "placement",
      entityType: "application",
      studentId,
      template: "selected",
      subject: `Selected: ${title}`,
      message: `Congratulations! You have been selected for ${title} at ${companyName}.`,
      data: { companyName, roleTitle: title, link: "/student/placement-history" },
      channels: ["email", "in_app"],
      priority: "critical",
    }),

  rejected: (studentId: string, companyName: string, title: string) =>
    notify({
      category: "placement",
      entityType: "application",
      studentId,
      template: "rejected",
      subject: `Update: ${title}`,
      message: `Your application for ${title} at ${companyName} will not be progressing further.`,
      data: { companyName, roleTitle: title, link: "/student/opportunities" },
      channels: ["email", "in_app"],
      priority: "normal",
    }),

  offerRecorded: (
    studentId: string,
    companyName: string,
    roleTitle: string,
    ctc: string,
    joiningDate: string
  ) =>
    notify({
      category: "placement",
      entityType: "offer",
      studentId,
      template: "offer",
      subject: `Offer from ${companyName}`,
      message: `An offer from ${companyName} for ${roleTitle} has been recorded.`,
      data: {
        companyName,
        roleTitle,
        ctc,
        joiningDate,
        link: "/student/placement-history",
      },
      channels: ["email", "in_app"],
      priority: "critical",
    }),

  documentRequested: (studentId: string, documentName: string, reason: string) =>
    notify({
      category: "documents",
      entityType: "document",
      studentId,
      template: "document_request",
      subject: `Action needed: ${documentName}`,
      message: `Please re-upload ${documentName}. Reason: ${reason}`,
      data: { documentName, reason, link: "/student/documents" },
      channels: ["email", "in_app"],
      priority: "high",
    }),
};

export const AdminNotifications = {
  applicationReceived: (driveTitle: string, studentName: string, count: number) =>
    notify({
      category: "placement",
      entityType: "application",
      subject: `New Application: ${driveTitle}`,
      message: `${studentName} has applied to ${driveTitle}. Total applications: ${count}`,
      channels: ["in_app"],
      priority: "low",
      roleFilter: ["TP_ADMIN"],
    }),

  driveDeadlineApproaching: (driveTitle: string, closeAt: Date, applicationCount: number) =>
    notify({
      category: "placement",
      entityType: "drive",
      subject: `Drive Closing Soon: ${driveTitle}`,
      message: `${driveTitle} applications close in 24 hours. Current applications: ${applicationCount}`,
      channels: ["email", "in_app"],
      priority: "normal",
      roleFilter: ["TP_ADMIN"],
    }),
};
